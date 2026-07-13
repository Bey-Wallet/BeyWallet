import React, { useEffect, useMemo } from 'react';
import { YStack, XStack, Text, Button, H1, Separator, Avatar, ScrollView } from "tamagui";
import { Check, XCircle, AlertCircle, Sprout, Zap } from "@tamagui/lucide-icons";
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useWalletStore } from '~/store/walletStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

interface ResultStageProps {
    status: 'success' | 'error' | 'cancelled';
    amount: string;
    mintUrl?: string;
    error?: string | null;
    onClose: () => void;
}

export function ResultStage({ status, amount, mintUrl, error, onClose }: ResultStageProps) {
    const isSuccess = status === 'success';
    const sats = parseInt(amount, 10) || 0;

    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = useMemo(() => {
        if (!btcData?.price) return '0.00';
        const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
    }, [sats, btcData?.price, secondaryCurrency]);

    const normalizeUrl = (url: string) => url.replace(/\/$/, "");

    const activeMint = useMemo(() => {
        if (!mintUrl) return null;
        return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl));
    }, [mints, mintUrl]);

    const mintDisplayName = useMemo(() => {
        if (!mintUrl) return "Selected Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return mintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, mintUrl]);

    useEffect(() => {
        if (isSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (status === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [status, isSuccess]);

    const timeString = useMemo(() => {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

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
                        {status === 'cancelled' ? 'Deposit Cancelled' : 'Deposit Failed'}
                    </Text>
                    <Text color="$gray10" fontSize="$4" textAlign="center" px="$4">
                        {error || 'An error occurred while depositing.'}
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
              
            >
                <YStack gap="$4">
                    {/* Oswald Typography Amount Display */}
                    <YStack gap="$3" py="$6" items="center" justify="center">
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$green10" lineHeight={54}>
                            +{currencyService.formatSats(sats)}
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
                            Deposit Successful
                        </Text>
                    </XStack>

                    {/* Description Text */}
                    <YStack px="$4" py="$2">
                        <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                            Your deposit has been recognized and ecash minted successfully.
                        </Text>
                    </YStack>

                    {/* Details Table */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                        <DetailItem
                            label="Status"
                            value="Completed"
                            valueColor="$green10"
                        />
                        <DetailItem
                            label="Mint"
                            value={mintDisplayName}
                            icon={
                                <Avatar rounded="$3" size="$1.5">
                                    <Avatar.Image src={activeMint?.icon} />
                                    <Avatar.Fallback bg="$green3" items="center" justify="center">
                                        <Sprout size={12} color="$green10" />
                                    </Avatar.Fallback>
                                </Avatar>
                            }
                        />
                        <DetailItem
                            label="Method"
                            value="Top Up via Lightning"
                            icon={<Zap size={16} color="$yellow10" />}
                        />
                        <DetailItem
                            label="Amount (SATS)"
                            value={currencyService.formatSats(sats)}
                        />
                        <DetailItem
                            label="Amount (Fiat)"
                            value={fiatValue}
                        />
                        <DetailItem
                            label="Time"
                            value={timeString}
                        />
                    </YStack>
                </YStack>
            </ScrollView>

            <YStack position="absolute" b={0} l={0} r={0} py="$4"  bg="$background" borderTopWidth={0}>
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
