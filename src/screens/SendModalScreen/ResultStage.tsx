import React, { useState } from 'react';
import { YStack, Text, Button, ScrollView } from "tamagui";
import { XCircle } from "@tamagui/lucide-icons";
import { Stack } from 'expo-router';

import { PendingTokenLayout } from '../../components/UI/PendingTokenLayout';
import { nfcService } from '../../services/nfcService';
import { ProcessingSheet, ProcessingStatus } from '../../components/UI/ProcessingSheet';

interface ResultStageProps {
    status: 'success' | 'error';
    amount: string;
    token?: string | null;
    mintUrl?: string;
    fee?: number;
    operationId?: string;
    error?: string | null;
    onClose: () => void;
    onReclaim?: () => void;
    title?: string;
}

export function ResultStage({
    status,
    amount,
    token,
    mintUrl,
    fee = 0,
    operationId,
    error,
    onClose,
    onReclaim,
    title = 'Pending Ecash'
}: ResultStageProps) {
    const isSuccess = status === 'success';
    const [isReclaiming, setIsReclaiming] = useState(false);
    
    const [showNfcSheet, setShowNfcSheet] = useState(false);
    const [nfcStatus, setNfcStatus] = useState<ProcessingStatus>('processing');
    const [nfcMessage, setNfcMessage] = useState('Preparing to send...');
    const [nfcError, setNfcError] = useState<string | undefined>(undefined);

    const handleNfcShare = async () => {
        if (!token) return;
        
        setShowNfcSheet(true);
        setNfcStatus('processing');
        setNfcMessage('Checking NFC status...');
        
        try {
            const enabled = await nfcService.isEnabled();
            if (!enabled) {
                setNfcStatus('error');
                setNfcMessage('NFC is disabled');
                setNfcError('Please enable NFC in your device settings.');
                
                // Fallback: try to open settings
                try {
                    await nfcService.goToNfcSetting();
                } catch (e) {
                    console.warn('Failed to open NFC settings', e);
                }
                return;
            }
            
            setNfcMessage('Approach the receiver tag or device...');
            
            // Start real working send (write to tag)
            await nfcService.writeNdefTag(token);
            
            setNfcStatus('success');
            setNfcMessage('Token sent successfully via NFC!');
        } catch (e: any) {
            console.error('NFC share error:', e);
            setNfcStatus('error');
            setNfcMessage('NFC Share Failed');
            setNfcError(e.message || 'An error occurred during NFC transmission.');
        }
    };

    const handleReclaim = async () => {
        if (onReclaim) {
            setIsReclaiming(true);
            try {
                await onReclaim();
                onClose();
            } catch (e: any) {
                // Toast is handled inside reclaim or if desired, passed as prop
            } finally {
                setIsReclaiming(false);
            }
        }
    };

    if (!isSuccess) {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" p="$4" bg="$background">
                <XCircle size={80} color="$red10" />
                <Text color="$red10" fontSize="$6" fontWeight="700" text="center">Send Failed</Text>
                <Text color="$gray10" fontSize="$4" text="center" px="$4">{error || 'An error occurred while creating the token.'}</Text>
                <Button theme="accent" size="$5" width="100%" onPress={onClose} mt="$4">Go Back</Button>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={{ title: title }} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 } as any}
                px="$0"
            >
                {token && (
                    <PendingTokenLayout
                        token={token}
                        amount={amount}
                        fee={fee}
                        mintUrl={mintUrl}
                        onReclaim={onReclaim ? handleReclaim : undefined}
                        isReclaiming={isReclaiming}
                        onNfcPress={handleNfcShare}
                    />
                )}
            </ScrollView>
            <ProcessingSheet
                visible={showNfcSheet}
                status={nfcStatus}
                title={nfcMessage}
                errorMessage={nfcError}
                variant="nfc"
                onClose={() => setShowNfcSheet(false)}
            />
        </YStack>
    );
}
