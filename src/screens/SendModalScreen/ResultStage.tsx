import React, { useState, useMemo } from 'react';
import { YStack, Text, Button, ScrollView, View, XStack, Separator, YGroup } from "tamagui";
import { XCircle, Check, Copy } from "@tamagui/lucide-icons";
import { Stack } from 'expo-router';

import { PendingTokenLayout } from '../../components/UI/PendingTokenLayout';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { StatusBadge } from '~/components/UI/StatusBadge';
import * as Haptics from 'expo-haptics';
import * as ExpoClipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    onCheckStatus?: () => void | Promise<void>;
    isCheckingStatus?: boolean;
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
    expiresAt,
    onCheckStatus,
    isCheckingStatus = false,
}: ResultStageProps) {
    const isSuccess = status === 'success';
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const [isReclaiming, setIsReclaiming] = useState(false);
    const insets = useSafeAreaInsets();

    const sendTime = useMemo(() => {
        return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    }, []);

    const handleCopyText = async (text: string, label: string) => {
        await ExpoClipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied!', { message: `${label} copied to clipboard` });
    };

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

    const primaryAmountLabel = primaryCurrency === 'SATS'
        ? currencyService.formatSats(Number(amount || 0))
        : fiatValue;
    const secondaryAmountLabel = primaryCurrency === 'SATS'
        ? fiatValue
        : currencyService.formatSats(Number(amount || 0));

    const handleReclaim = async () => {
        if (onReclaim) {
            setIsReclaiming(true);
            try {
                await onReclaim();
                onClose();
            } catch (e: any) {
                // Toast is handled inside reclaim
            } finally {
                setIsReclaiming(false);
            }
        }
    };

    // Shared header options used in all branches
    const badgeStatus = !isSuccess ? 'failed' : token ? 'pending' : 'success';
    const headerOptions = {
        headerTitleAlign: 'center' as const,
        headerTitle: () => (
            <YStack items="center" justify="center" gap={1}>
                <Text fontWeight="900" fontSize={18} color="$color" lineHeight={22}>
                    {primaryAmountLabel}
                </Text>
                <Text fontSize={12} fontWeight="600" color="$gray10" lineHeight={16}>
                    {secondaryAmountLabel}
                </Text>
            </YStack>
        ),
        headerRight: () => (
            <XStack pr="$2" items="center">
                <StatusBadge status={badgeStatus} />
            </XStack>
        ),
    };

    const successHeaderOptions = {
        title: title || 'Success',
        headerTitleAlign: 'center' as const,
        headerRight: () => null,
    };

    if (!isSuccess) {
        return (
            <YStack flex={1} bg="$background">
                <Stack.Screen options={headerOptions} />
                <YStack flex={1} justify="center" items="center" gap="$4" p="$4">
                    <YStack
                        width={100}
                        height={100}
                        rounded="$10"
                        bg="$red4"
                        items="center"
                        justify="center"
                        animation="bouncy"
                        enterStyle={{ scale: 0, opacity: 0 }}
                    >
                        <XCircle size={50} color="$red10" strokeWidth={2.5} />
                    </YStack>
                    <YStack items="center" gap="$2">
                        <Text fontSize="$7" fontWeight="900" color="$color">Send Failed</Text>
                        <Text color="$gray10" fontSize="$4" textAlign="center" px="$4">
                            {error || 'An error occurred while creating the token.'}
                        </Text>
                    </YStack>
                    <Button theme="accent" size="$5" width="100%" onPress={onClose} mt="$4">Go Back</Button>
                </YStack>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={token ? headerOptions : successHeaderOptions} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 150 } as any}
                
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
                        headerStatus="pending"
                        onCheckStatus={onCheckStatus}
                        isCheckingStatus={isCheckingStatus}
                    />
                ) : (
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

                        {/* Success Badge */}
                        <XStack
                            self="center"
                            items="center"
                            gap="$2"
                            bg="$green9"
                            px="$4"
                            py="$3"
                            rounded="$10"
                        >
                            <Check size={16} color="white" />
                            <Text
                                fontSize="$3"
                                fontWeight="700"
                                color="white"
                            >
                                Sent Successfully
                            </Text>
                        </XStack>

                        {/* Description Text */}
                        <YStack px="$4" py="$2">
                            <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                                The ecash has been sent from your wallet.
                            </Text>
                        </YStack>

                        {/* Details List */}
                        <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6">
                            <View p="$3" px="$4">
                                <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                            </View>
                            <Separator borderColor="$borderColor" opacity={0.3} />
                            <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                <DetailItem
                                    label="Mint"
                                    value={mintUrl ? (mintUrl.replace(/^https?:\/\//, '').split('/')[0]) : 'Unknown'}
                                    isCopyable={!!mintUrl}
                                    onCopy={mintUrl ? () => handleCopyText(mintUrl, 'Mint URL') : undefined}
                                />
                                {fee > 0 && (
                                    <DetailItem
                                        label="Fee"
                                        value={`${fee} sats`}
                                    />
                                )}
                                <DetailItem
                                    label="Time"
                                    value={sendTime}
                                />
                            </YGroup>
                        </YStack>
                    </YStack>
                )}
            </ScrollView>

            {/* Final Done Button (Only if not pending token link) */}
            {!token && (
                <YStack position="absolute" b={0} l={0} r={0} px="$4" pt="$4" pb={insets.bottom + 16} bg="$background" borderTopWidth={1} borderColor="$gray3">
                    <Button
                        bg="$green10"
                        color="white"
                        size="$5"
                        height={50}
                        onPress={onClose}
                        fontWeight="800"
                        rounded="$4"
                    >
                        DONE
                    </Button>
                </YStack>
            )}
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
