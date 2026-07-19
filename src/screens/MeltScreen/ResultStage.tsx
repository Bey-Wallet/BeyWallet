import React from 'react';
import { YStack, XStack, Text, Button, Separator, ScrollView } from 'tamagui';
import { Check, XCircle } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

interface MeltResultStageProps {
    status: 'success' | 'error';
    amount: number;
    feeReserve: number;
    error?: string | null;
    onClose: () => void;
}

export function MeltResultStage({ status, amount, feeReserve, error, onClose }: MeltResultStageProps) {
    const { secondaryCurrency } = useSettingsStore();
    const isSuccess = status === 'success';

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = btcData?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(amount, btcData.price),
            secondaryCurrency as CurrencyCode
        )
        : '...';

    React.useEffect(() => {
        if (isSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [status, isSuccess]);

    if (!isSuccess) {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" px="$4" bg="$background">
                <YStack
                    width={100}
                    height={100}
                    rounded="$10"
                    bg="$red4"
                    items="center"
                    justify="center"
                    animation="bouncy"
                >
                    <XCircle size={50} color="$red10" strokeWidth={2.5} />
                </YStack>
                <YStack items="center" gap="$2">
                    <Text fontSize="$7" fontWeight="900" color="$color">Payment Failed</Text>
                    <Text color="$gray10" fontSize="$4" textAlign="center" px="$4">
                        {error || 'The Lightning payment could not be completed.'}
                    </Text>
                </YStack>
                <Button theme="gray" size="$5" width="100%" onPress={onClose} mt="$4">Go Back</Button>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 } as any}
                px="$4"
            >
                <YStack gap="$4">
                    {/* Oswald Typography Amount Display */}
                    <YStack gap="$3" py="$6" items="center" justify="center">
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$red10" lineHeight={54}>
                            -{currencyService.formatSats(amount)}
                        </Text>
                        <Text color="$accent5" fontWeight="600" fontSize={16}>
                            ≈ {fiatValue} {secondaryCurrency}
                        </Text>
                    </YStack>

                    {/* Centered badge */}
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
                            Payment Sent
                        </Text>
                    </XStack>

                    {/* Description Text */}
                    <YStack px="$4" py="$2">
                        <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                            Successfully paid Lightning invoice.
                        </Text>
                    </YStack>

                    {/* Details Table */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                        <DetailItem
                            label="Total Amount"
                            value={currencyService.formatSats(amount)}
                        />
                        <DetailItem
                            label="Fee Reserve"
                            value={`~${feeReserve} sats`}
                            valueColor="$orange10"
                        />
                        <DetailItem
                            label="Status"
                            value="PAID"
                            valueColor="$green10"
                        />
                        <DetailItem
                            label="Date"
                            value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        <DetailItem
                            label="Fiat Value"
                            value={fiatValue}
                        />
                    </YStack>
                </YStack>
            </ScrollView>

            <YStack position="absolute" b={0} l={0} r={0} py="$4" px="$4" bg="$background" borderTopWidth={0}>
                <Button
                    theme="accent"
                    size="$5"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onClose();
                    }}
                >
                    Done
                </Button>
            </YStack>
        </YStack>
    );
}

function DetailItem({ label, value, icon, valueColor }: { label: string, value: string, icon?: React.ReactNode, valueColor?: string }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" fontWeight="800" color={valueColor || "$color"} numberOfLines={1} style={{ maxWidth: 220 }}>
                    {value}
                </Text>
            </XStack>
        </XStack>
    );
}
