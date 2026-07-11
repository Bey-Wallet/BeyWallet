import React, { useMemo } from 'react';
import { YStack, XStack, Text, Button, Separator, ScrollView } from "tamagui";
import { Check, XCircle, AlertCircle } from "@tamagui/lucide-icons";
import { useWalletStore } from "~/store/walletStore";
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

interface ResultStageProps {
    status: 'success' | 'error' | 'cancelled';
    amount: string;
    sourceMintUrl: string;
    targetMintUrl: string;
    error: string | null;
    onClose: () => void;
}

export function ResultStage({ status, amount, sourceMintUrl, targetMintUrl, error, onClose }: ResultStageProps) {
    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();

    const getMintName = (url: string) => {
        const mint = mints.find(m => m.mintUrl.replace(/\/$/, '') === url.replace(/\/$/, ''));
        return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    };

    const isSuccess = status === 'success';

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = useMemo(() => {
        if (!btcData?.price) return '0.00';
        const fiat = currencyService.convertSatsToCurrency(Number(amount), btcData.price);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
    }, [amount, btcData?.price, secondaryCurrency]);

    if (!isSuccess) {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" p="$4" bg="$background">
                <YStack
                    width={100}
                    height={100}
                    rounded="$10"
                    bg={status === 'cancelled' ? "$orange4" : "$red4"}
                    items="center"
                    justify="center"
                    animation="bouncy"
                >
                    {status === 'cancelled' ? (
                        <AlertCircle size={50} color="$orange10" strokeWidth={2.5} />
                    ) : (
                        <XCircle size={50} color="$red10" strokeWidth={2.5} />
                    )}
                </YStack>
                <YStack items="center" gap="$2">
                    <Text fontSize="$7" fontWeight="900" color="$color">
                        {status === 'cancelled' ? 'Swap Cancelled' : 'Swap Failed'}
                    </Text>
                    <Text color="$gray10" fontSize="$4" textAlign="center" px="$4">
                        {error || 'An error occurred while swapping.'}
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
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$color" lineHeight={54}>
                            {currencyService.formatSats(Number(amount))}
                        </Text>
                        <Text color="$accent5" fontWeight="600" fontSize={16}>
                            ≈ {fiatValue} {secondaryCurrency}
                        </Text>
                    </YStack>

                    {/* Centered green badge */}
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
                            Swap Complete
                        </Text>
                    </XStack>

                    {/* Description Text */}
                    <YStack px="$4" py="$2">
                        <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                            Your swap has been processed successfully.
                        </Text>
                    </YStack>

                    {/* Details Table */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                        <DetailItem
                            label="Status"
                            value="Success"
                            valueColor="$green10"
                        />
                        <DetailItem
                            label="Amount"
                            value={currencyService.formatSats(Number(amount))}
                        />
                        <DetailItem
                            label="Source Mint"
                            value={getMintName(sourceMintUrl)}
                        />
                        <DetailItem
                            label="Target Mint"
                            value={getMintName(targetMintUrl)}
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
                    onPress={onClose}
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
