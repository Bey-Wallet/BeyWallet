import React, { useState } from 'react';
import { YStack, Text, Button, ScrollView, View, XStack } from "tamagui";
import { XCircle, Check, ChevronDown, ChevronUp } from "@tamagui/lucide-icons";
import { Stack } from 'expo-router';

import { PendingTokenLayout } from '../../components/UI/PendingTokenLayout';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { StatusBadge } from '~/components/UI/StatusBadge';
import * as Haptics from 'expo-haptics';

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
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [isReclaiming, setIsReclaiming] = useState(false);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = React.useMemo(() => {
        if (!btcData?.price) return '...';
        return currencyService.formatValue(
            currencyService.convertSatsToCurrency(Number(amount), btcData.price),
            secondaryCurrency as CurrencyCode
        );
    }, [amount, btcData?.price, secondaryCurrency]);

    const primaryAmountLabel = primaryCurrency === 'SATS'
        ? `₿${Number(amount || 0).toLocaleString()}`
        : fiatValue;
    const secondaryAmountLabel = primaryCurrency === 'SATS'
        ? fiatValue
        : `₿${Number(amount || 0).toLocaleString()} sats`;

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
            <Stack.Screen options={headerOptions} />
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
                        headerStatus="pending"
                        onCheckStatus={onCheckStatus}
                        isCheckingStatus={isCheckingStatus}
                    />
                ) : (
                    <YStack flex={1} p="$4" gap="$4">
                        {/* Success icon */}
                        <YStack items="center" justify="center" py="$6" gap="$3">
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
                        </YStack>

                        {/* Details table */}
                        <ListTable width="100%">
                            <ListTableRow
                                label="Transaction Details"
                                rightContent={
                                    isDetailsExpanded
                                        ? <ChevronUp size={18} color="$gray10" />
                                        : <ChevronDown size={18} color="$gray10" />
                                }
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsDetailsExpanded(v => !v);
                                }}
                            />
                            {isDetailsExpanded && (
                                <>
                                    {primaryCurrency === 'FIAT' ? (
                                        <>
                                            <ListTableRow
                                                label="Amount"
                                                value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'}
                                            />
                                            <ListTableRow label="Sats" value={`₿${amount} sats`} />
                                        </>
                                    ) : (
                                        <>
                                            <ListTableRow label="Amount" value={`₿${amount} sats`} />
                                            <ListTableRow
                                                label="Fiat"
                                                value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'}
                                            />
                                        </>
                                    )}
                                    {fee > 0 && <ListTableRow label="Fee" value={`₿${fee} sats`} />}
                                    {mintUrl && (
                                        <ListTableRow
                                            label="Mint"
                                            value={mintUrl.replace(/^https?:\/\//, '').split('/')[0]}
                                        />
                                    )}
                                </>
                            )}
                        </ListTable>

                        <YStack mt="auto" pb="$6">
                            <Button
                                size="$5"
                                height={55}
                                rounded="$5"
                                theme="accent"
                                fontWeight="800"
                                onPress={onClose}
                                pressStyle={{ scale: 0.97 }}
                            >
                                Done
                            </Button>
                        </YStack>
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
