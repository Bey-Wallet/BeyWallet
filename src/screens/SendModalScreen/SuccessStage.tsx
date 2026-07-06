import React from 'react';
import { YStack, Text, Button, Separator, Circle, H2, ScrollView, H6 } from "tamagui";
import { Check } from "@tamagui/lucide-icons";
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { Stack } from 'expo-router';

interface SuccessStageProps {
    amount: string;
    mintUrl?: string;
    fee?: number;
    onClose: () => void;
}

export function SuccessStage({
    amount,
    mintUrl,
    fee = 0,
    onClose
}: SuccessStageProps) {
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = btcData?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(Number(amount), btcData.price),
            secondaryCurrency as CurrencyCode
        )
        : '...';

    return (
        <YStack flex={1} bg="$background" p="$0" gap="$3">

            <YStack width="100%" justify="space-between" height={300} bg="$gray2" rounded="$5" items="center" gap="$4">

                <H6 width="100%" p="$3" text="center" borderBottomWidth={1} borderColor="$borderColor" fontWeight="800" color="$color">Sent Successfully!</H6>
                <YStack items="center" justify="center">
                    {primaryCurrency === 'SATS' ? (
                        <>
                            <H2 fontSize="$9" fontWeight="900" color="$green11">
                                ₿{parseInt(amount).toLocaleString()}
                            </H2>
                            <H2 fontSize="$6" fontWeight="100" color="$gray10">
                                sats
                            </H2>
                        </>
                    ) : (
                        <>
                            <H2 fontSize="$9" fontWeight="900" color="$green11">
                                {fiatValue}
                            </H2>
                            <H2 fontSize="$6" fontWeight="100" color="$gray10">
                                ₿{parseInt(amount).toLocaleString()} sats
                            </H2>
                        </>
                    )}
                </YStack>
                <YStack items="center" width="100%" gap="$1" p="$3" borderTopWidth={1} borderColor="$borderColor">
                    <Text color="$gray10" fontSize="$4">The recipient has claimed your ecash</Text>
                </YStack>
            </YStack>


            <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                <DetailItem label="Status" value="Claimed" />
                <DetailItem label="Date" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                <DetailItem label="Mint" value={mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown'} />
                <DetailItem label="Fee Paid" value={`₿${fee} sats`} />
                {primaryCurrency === 'FIAT' ? (
                    <DetailItem label="Sats Value" value={`₿${parseInt(amount).toLocaleString()} sats`} />
                ) : (
                    <DetailItem label="Fiat Value" value={fiatValue} />
                )}
            </YStack>

            <YStack mt="auto">
                <Button
                    theme="green"
                    bg="$green10"
                    color="white"
                    size="$5"
                    fontWeight="800"
                    onPress={onClose}
                >
                    Done
                </Button>
            </YStack>
        </YStack >
    );
}

function DetailItem({ label, value }: { label: string, value: string }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                {value}
            </Text>
        </XStack>
    );
}

// Need to import XStack for DetailItem
import { XStack } from "tamagui";
