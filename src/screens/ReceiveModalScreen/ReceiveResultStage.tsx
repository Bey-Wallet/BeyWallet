import React, { useEffect, useState, useMemo } from 'react';
import { Spinner, YStack, XStack, Text, Button, View, Separator, ScrollView, YGroup } from "tamagui";
import { Check, ArrowDownLeft, AlertCircle, Copy, Clock } from "@tamagui/lucide-icons";
import * as Haptics from 'expo-haptics';
import * as ExpoClipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode } from '../../services/currencyService';
import { Buffer } from 'buffer';
import { useToastController } from '@tamagui/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Ensure Buffer is available globally
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

interface ReceiveResultStageProps {
    status: 'success' | 'error';
    amount: string;
    token?: string;
    mintUrl?: string;
    error?: string | null;
    isReceiveLater?: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onClaimNow?: () => void;
    title?: string;
}

export function ReceiveResultStage({
    status,
    amount,
    token,
    mintUrl,
    error,
    isReceiveLater,
    isLoading,
    onClose,
    onClaimNow,
    title = 'Receive Result'
}: ReceiveResultStageProps) {
    const isSuccess = status === 'success';
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();
    const router = useRouter();
    const toast = useToastController();
    const [copied, setCopied] = useState(false);
    const insets = useSafeAreaInsets();

    // Filtered states
    const [currentToken] = useState<string>(token || '');

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = useMemo(() => {
        if (!btcData?.price) return '...';
        return currencyService.formatValue(
            currencyService.convertSatsToCurrency(Number(amount), btcData.price),
            secondaryCurrency as CurrencyCode
        );
    }, [amount, btcData?.price, secondaryCurrency]);

    const decoded = useMemo(() => {
        if (!token) return null;
        try {
            const { decodeToken } = require('../../services/core/tokenUtils');
            return decodeToken(token);
        } catch (e) {
            console.warn('[ReceiveResultStage] Failed to decode token:', e);
            return null;
        }
    }, [token]);

    const [estimatedFee, setEstimatedFee] = useState(0);
    useEffect(() => {
        const mint = decoded?.token?.[0]?.mint || mintUrl;
        const proofCount = decoded?.proofs?.length || 0;
        if (mint && proofCount > 0) {
            const { mintManager } = require('../../services/core');
            mintManager.getFeePpk(mint).then((feePpk: number) => {
                const fee = feePpk > 0 ? Math.ceil(proofCount * feePpk / 1000) : 0;
                setEstimatedFee(fee);
            }).catch(() => setEstimatedFee(0));
        }
    }, [decoded, mintUrl]);

    const receiveTime = useMemo(() => {
        return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    }, []);


    useEffect(() => {
        if (isSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [status]);

    const handleCopy = async () => {
        if (currentToken) {
            await ExpoClipboard.setStringAsync(currentToken);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            toast.show('Copied!', { message: 'Token copied to clipboard' });
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyText = async (text: string, label: string) => {
        await ExpoClipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied!', { message: `${label} copied to clipboard` });
    };

    const isOfflineSaved = !isSuccess && error && (error.includes('Could not connect to mint') || error.includes('saved to your transaction history') || error.includes('saved in your history'));

    if (!isSuccess) {
        if (isOfflineSaved) {
            return (
                <YStack flex={1} justify="center" items="center" gap="$4" p="$4" bg="$background">
                    <Clock size={80} color="$orange10" />
                    <Text color="$orange10" fontSize="$6" fontWeight="700" text="center">Received Offline</Text>
                    <Text color="$gray10" fontSize="$4" text="center" px="$4" lineHeight={22}>{error}</Text>
                    <Button theme="accent" size="$5" width="100%" onPress={onClose} mt="$4">Got it</Button>
                </YStack>
            );
        }

        return (
            <YStack flex={1} justify="center" items="center" gap="$4" p="$4" bg="$background">
                <AlertCircle size={80} color="$red10" />
                <Text color="$red10" fontSize="$6" fontWeight="700" text="center">Receive Failed</Text>
                <Text color="$gray10" fontSize="$4" text="center" px="$4">{error || 'An error occurred while receiving the token.'}</Text>
                <Button theme="accent" size="$5" width="100%" onPress={onClose} mt="$4">Go Back</Button>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={{ title: isReceiveLater ? 'Token Saved' : title }} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 } as any}
                px="$4"
            >
                <YStack gap="$4">
                    {/* Middle Amount Display */}
                    <YStack gap="$3" py="$6" items="center" justify="center">
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                            {currencyService.formatSats(Number(amount || 0))}
                        </Text>
                        <Text color="$accent5" fontWeight="600" fontSize={16}>
                            {fiatValue}
                        </Text>
                    </YStack>

                    {/* Proof verification status badge */}
                    <XStack
                        self="center"
                        items="center"
                        gap="$2"
                        bg={
                            isReceiveLater ? '$orange9' : '$green9'
                        }
                        px="$4"
                        py="$3"
                        rounded="$10"
                    >
                        {isReceiveLater ? <Clock size={16} color="white" /> : <Check size={16} color="white" />}
                        <Text
                            fontSize="$3"
                            fontWeight="700"
                            color="white"
                        >
                            {isReceiveLater ? 'Saved Later' : 'Received'}
                        </Text>
                    </XStack>

                    {/* Description Text */}
                    <YStack px="$4" py="$2">
                        <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                            {isReceiveLater ? 'You can claim this later from History.' : 'The ecash has been added to your wallet.'}
                        </Text>
                    </YStack>

                    {/* Details List */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6">
                        <View p="$3" px="$4">
                            <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                        </View>
                        <Separator borderColor="$borderColor" opacity={0.3} />
                        <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                            {token && (
                                <DetailItem
                                    label="Token"
                                    value={`${token.substring(0, 10)}...${token.substring(token.length - 6)}`}
                                    isCopyable
                                    onCopy={() => handleCopyText(token, 'Token')}
                                />
                            )}
                            <DetailItem
                                label="Mint"
                                value={mintUrl ? (mintUrl.replace(/^https?:\/\//, '').split('/')[0]) : 'Unknown'}
                                isCopyable={!!mintUrl}
                                onCopy={mintUrl ? () => handleCopyText(mintUrl, 'Mint URL') : undefined}
                            />
                            <DetailItem
                                label="Proofs"
                                value={(decoded?.proofs?.length || 0).toString()}
                            />
                            <DetailItem
                                label="Fee"
                                value={`${estimatedFee} sats`}
                            />
                            <DetailItem
                                label="Time"
                                value={receiveTime}
                            />
                        </YGroup>
                    </YStack>

                    {/* Action Buttons (If Receive Later) */}
                    {isReceiveLater && currentToken && (
                        <YStack gap="$2" >
                            <Button
                                onPress={onClaimNow}
                                bg="$accent10"
                                color="white"
                                size="$5"
                                height={55}
                                rounded="$4"
                                fontWeight="800"
                                disabled={isLoading}
                                icon={isLoading ? <Spinner size="small" color="white" /> : <ArrowDownLeft size={20} color="white" />}
                            >
                                CLAIM NOW
                            </Button>
                            <Button
                                onPress={handleCopy}
                                size="$5"
                                height={55}
                                rounded="$4"
                                bg="$gray3"
                                color="$color"
                                fontWeight="800"
                                icon={copied ? <Check size={20} /> : <Copy size={20} />}
                            >
                                {copied ? 'Copied!' : 'Copy Token'}
                            </Button>
                        </YStack>
                    )}
                </YStack>
            </ScrollView>

            {/* Final Done Button (Only if not receive later OR if not busy claiming) */}
            <YStack position="absolute" b={0} l={0} r={0} px="$4" pt="$2" bg="$background" borderTopWidth={1} borderColor="$gray3">
                <Button
                    bg={isReceiveLater ? "$gray3" : "$green10"}
                    size="$5"
                    height={50}
                    onPress={onClose}
                    fontWeight="800"
                    color={isReceiveLater ? "$color" : "white"}
                    rounded="$4"
                    disabled={isLoading}
                >
                    DONE
                </Button>
            </YStack>
        </YStack>
    );
}

function DetailItem({ label, value, isCopyable, onCopy }: { label: string, value: string, isCopyable?: boolean, onCopy?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}

