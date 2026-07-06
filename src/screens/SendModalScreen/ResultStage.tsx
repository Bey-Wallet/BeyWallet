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
                        {/* Big Amount Display */}
                        <YStack width="100%" justify="center" items="center" py="$2">
                            {primaryCurrency === 'SATS' ? (
                                <>
                                    <Text fontSize={38} fontWeight="900" color="$color">
                                        ₿{Number(amount || 0).toLocaleString()}
                                    </Text>
                                    <Text fontSize="$4" fontWeight="600" color="$gray10" mt="$1">
                                        {fiatValue}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text fontSize={38} fontWeight="900" color="$color">
                                        {fiatValue}
                                    </Text>
                                    <Text fontSize="$4" fontWeight="600" color="$gray10" mt="$1">
                                        ₿{Number(amount || 0).toLocaleString()} sats
                                    </Text>
                                </>
                            )}
                        </YStack>

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

                        <ListTable width="100%" mt="$2">
                            <ListTableRow
                                label="Transaction Details"
                                rightContent={
                                    isDetailsExpanded ? (
                                        <ChevronUp size={18} color="$gray10" />
                                    ) : (
                                        <ChevronDown size={18} color="$gray10" />
                                    )
                                }
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsDetailsExpanded(!isDetailsExpanded);
                                }}
                            />

                            {isDetailsExpanded && (
                                <>
                                    {primaryCurrency === 'FIAT' ? (
                                        <>
                                            <ListTableRow label="Amount" value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'} />
                                            <ListTableRow label="Sats" value={`₿${amount} sats`} />
                                        </>
                                    ) : (
                                        <>
                                            <ListTableRow label="Amount" value={`₿${amount} sats`} />
                                            <ListTableRow label="Fiat" value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'} />
                                        </>
                                    )}
                                    {fee > 0 && <ListTableRow label="Fee" value={`₿${fee} sats`} />}
                                    {mintUrl && (
                                        <ListTableRow label="Mint" value={mintUrl.replace(/^https?:\/\//, '').split('/')[0]} />
                                    )}
                                </>
                            )}
                        </ListTable>
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
