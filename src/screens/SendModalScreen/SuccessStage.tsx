import React from 'react';
import { YStack, XStack, Text, Button, Separator, H2, ScrollView, H6 } from "tamagui";
import { Check } from "@tamagui/lucide-icons";
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { Stack } from 'expo-router';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { StatusBadge } from '~/components/UI/StatusBadge';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@tamagui/lucide-icons';

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
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

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

    const primaryAmountLabel = primaryCurrency === 'SATS'
        ? currencyService.formatSats(parseInt(amount))
        : fiatValue;
    const secondaryAmountLabel = primaryCurrency === 'SATS'
        ? fiatValue
        : currencyService.formatSats(parseInt(amount));

    return (
        <YStack flex={1} bg="$background" p="$0" gap="$3">
            {/* Header: amount as title + Success badge */}
            <Stack.Screen
                options={{
                    headerTitleAlign: 'center',
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
                            <StatusBadge status="success" />
                        </XStack>
                    ),
                }}
            />

            {/* Success icon card */}
            <YStack width="100%" justify="center" items="center" gap="$4" py="$6" bg="$gray2" rounded="$5">
                <YStack
                    width={90}
                    height={90}
                    rounded="$10"
                    bg="$green4"
                    items="center"
                    justify="center"
                    animation="bouncy"
                    enterStyle={{ scale: 0, opacity: 0 }}
                >
                    <Check size={46} color="$green10" strokeWidth={3} />
                </YStack>
                <YStack items="center" gap="$1">
                    <Text fontSize="$6" fontWeight="900" color="$color">Sent Successfully!</Text>
                    <Text color="$gray10" fontSize="$4">The recipient has claimed your ecash</Text>
                </YStack>
            </YStack>

            {/* Details table */}
            <ListTable>
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
                        <ListTableRow label="Status" value="Claimed" />
                        <ListTableRow
                            label="Date"
                            value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        {mintUrl && (
                            <ListTableRow
                                label="Mint"
                                value={mintUrl.replace(/^https?:\/\//, '').split('/')[0]}
                            />
                        )}
                        <ListTableRow label="Fee Paid" value={currencyService.formatSats(fee)} />
                        {primaryCurrency === 'FIAT' ? (
                            <ListTableRow label="Sats Value" value={currencyService.formatSats(parseInt(amount))} />
                        ) : (
                            <ListTableRow label="Fiat Value" value={fiatValue} />
                        )}
                    </>
                )}
            </ListTable>

            <YStack mt="auto" px="$4" pb="$6">
                <Button
                    theme="green"
                    bg="$green10"
                    color="white"
                    size="$5"
                    height={55}
                    rounded="$5"
                    fontWeight="800"
                    onPress={onClose}
                >
                    Done
                </Button>
            </YStack>
        </YStack>
    );
}
