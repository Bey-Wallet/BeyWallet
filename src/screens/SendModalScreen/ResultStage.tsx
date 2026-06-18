import React, { useState } from 'react';
import { YStack, Text, Button, ScrollView, View, XStack } from "tamagui";
import { XCircle, Check } from "@tamagui/lucide-icons";
import { Stack } from 'expo-router';

import { PendingTokenLayout } from '../../components/UI/PendingTokenLayout';

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
    expiresAt?: number;
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
    title = 'Pending Ecash',
    expiresAt
}: ResultStageProps) {
    const isSuccess = status === 'success';
    const [isReclaiming, setIsReclaiming] = useState(false);

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
                <Text color="$red10" fontSize="$6" fontWeight="700" textAlign="center">Send Failed</Text>
                <Text color="$gray10" fontSize="$4" textAlign="center" px="$4">{error || 'An error occurred while creating the token.'}</Text>
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
                {token ? (
                    <PendingTokenLayout
                        token={token}
                        amount={amount}
                        fee={fee}
                        mintUrl={mintUrl}
                        onReclaim={onReclaim ? handleReclaim : undefined}
                        isReclaiming={isReclaiming}
                        expiresAt={expiresAt}
                    />
                ) : (
                    <YStack flex={1} p="$4" justify="center" items="center" gap="$6" mt="$6">
                        <View
                            width={100}
                            height={100}
                            rounded="$10"
                            bg="$green4"
                            items="center"
                            justify="center"
                            animation="bouncy"
                            enterStyle={{ scale: 0, opacity: 0 }}
                        >
                            <Check size={50} color="$green10" strokeWidth={3} />
                        </View>

                        <YStack items="center" gap="$2">
                            <Text fontSize="$7" fontWeight="900" color="$color">Success!</Text>
                            <Text fontSize="$4" color="$gray10" textAlign="center">
                                Transaction of ₿{amount} sats completed.
                            </Text>
                        </YStack>

                        <YStack width="100%" gap="$0" bg="$gray2" rounded="$5" overflow="hidden" mt="$4">
                            <XStack justify="space-between" p="$4" borderBottomWidth={1} borderColor="$color3">
                                <Text color="$gray10" fontWeight="600">Amount</Text>
                                <Text color="$color" fontWeight="800">₿{amount} sats</Text>
                            </XStack>
                            {fee > 0 && (
                                <XStack justify="space-between" p="$4" borderBottomWidth={1} borderColor="$color3">
                                    <Text color="$gray10" fontWeight="600">Fee</Text>
                                    <Text color="$color" fontWeight="800">₿{fee} sats</Text>
                                </XStack>
                            )}
                            {mintUrl && (
                                <XStack justify="space-between" p="$4">
                                    <Text color="$gray10" fontWeight="600">Mint</Text>
                                    <Text color="$color" fontWeight="800">{mintUrl.replace(/^https?:\/\//, '').split('/')[0]}</Text>
                                </XStack>
                            )}
                        </YStack>

                        <Button
                            mt="auto"
                            size="$5"
                            theme="accent"
                            fontWeight="800"
                            rounded="$4"
                            width="100%"
                            onPress={onClose}
                            pressStyle={{ scale: 0.97 }}
                        >
                            Done
                        </Button>
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
