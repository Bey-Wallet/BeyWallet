import React, { useMemo } from 'react';
import { YStack, XStack, Text, Button, Separator, ScrollView, View, YGroup } from "tamagui";
import { Check, Copy } from "@tamagui/lucide-icons";
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ExpoClipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';

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
    const toast = useToastController();

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

    const handleCopyText = async (text: string, label: string) => {
        await ExpoClipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied!', { message: `${label} copied to clipboard` });
    };

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
        headerRight: () => null,
    };

    const mintDomain = mintUrl
        ? mintUrl.replace(/^https?:\/\//, '').split('/')[0]
        : 'Unknown';

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={headerOptions} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 } as any}
               
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
                        <Text fontSize="$3" fontWeight="700" color="white">
                            Sent Successfully
                        </Text>
                    </XStack>

                    {/* Description Text */}
                    <YStack px="$4" py="$2">
                        <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                            The ecash has been sent from your wallet.
                        </Text>
                    </YStack>

                    {/* Details List (matching ResultStage details card) */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6">
                        <View p="$3" px="$4">
                            <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                        </View>
                        <Separator borderColor="$borderColor" opacity={0.3} />
                        <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                            {mintUrl && (
                                <DetailItem
                                    label="Mint"
                                    value={mintDomain}
                                    isCopyable
                                    onCopy={() => handleCopyText(mintUrl, 'Mint URL')}
                                />
                            )}
                            <DetailItem
                                label="Fee Paid"
                                value={`${fee} sats`}
                            />
                            <DetailItem
                                label="Time"
                                value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            />
                            {primaryCurrency === 'FIAT' ? (
                                <DetailItem label="Sats Value" value={currencyService.formatSats(Number(amount))} />
                            ) : (
                                <DetailItem label="Fiat Value" value={fiatValue} />
                            )}
                        </YGroup>
                    </YStack>
                </YStack>
            </ScrollView>

            {/* Final Done Button */}
            <YStack position="absolute" b="$4" l="$1" r="$1">
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
