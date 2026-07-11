import React, { useMemo } from 'react';
import { YStack, XStack, Text, Button, H1, Separator, Avatar, View } from "tamagui";
import { Sprout, Zap } from "@tamagui/lucide-icons";
import { Spinner } from '../../components/UI/Spinner';
import { ProcessingSheet } from "~/components/UI/ProcessingSheet";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
    amount: string;
    mintUrl: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onBack: () => void;
}

export function ConfirmStage({ amount, mintUrl, isLoading, onConfirm, onBack }: ConfirmStageProps) {
    const sats = parseInt(amount, 10) || 0;
    const { mints } = useWalletStore();
    const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = useMemo(() => {
        return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
    }, [secondaryCurrency]);

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

    const formattedSatsString = useMemo(() => {
        return sats.toLocaleString('en-US');
    }, [sats]);

    const dynamicFontSize = useMemo(() => {
        const len = formattedSatsString.length + 2; // +2 for +₿
        if (len <= 6) return 44;
        if (len <= 8) return 38;
        if (len <= 10) return 32;
        if (len <= 13) return 26;
        return 20;
    }, [formattedSatsString]);

    return (
        <YStack flex={1} justify="space-between">
            <YStack gap="$4" width="100%">
                {/* Hero Card Box Container matching AmountStage */}
                <YStack
                    width="100%"
                    bg="$gray2"
                    rounded="$5"
                    p="$4"
                    items="center"
                    gap="$3"
                    borderWidth={0}
                    borderColor="$borderColor"
                >
                    {/* Mint info header badge */}



                    {/* Amount Display Section */}
                    <YStack items="center" justify="center" py="$4" gap="$1" width="100%">
                        <Text color="$gray10" fontSize="$3" fontWeight="500">
                            Confirm Deposit Amount
                        </Text>

                        <H1
                            fontSize={dynamicFontSize}
                            fontVariant={['tabular-nums']}
                            fontWeight="700"
                            letterSpacing={-1}
                            py="$3"
                            color="$color"
                            text="center"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ maxWidth: '100%', overflow: 'hidden' }}
                        >
                            +{showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`}
                        </H1>


                        <Text fontSize="$3" fontWeight="600" color="$accent10">
                            ≈ {fiatValue} {secondaryCurrency}
                        </Text>

                    </YStack>
                </YStack>

                {/* Detailed Breakdown Card */}
                <YStack bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
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
                        value={`${formattedSatsString} SATS`}
                    />
                    <DetailItem
                        label="Amount (Fiat)"
                        value={`${currencySymbol}${fiatValue}`}
                    />
                    <DetailItem
                        label="Estimated Fee"
                        value="0 SATS (Free)"
                        valueColor="$green10"
                    />
                </YStack>
            </YStack>

            {/* Action Buttons */}
            <YStack gap="$3" pb="$2">
                <Button
                    theme="accent"
                    size="$5"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    icon={isLoading ? <Spinner size="small" color="$color" /> : undefined}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onConfirm();
                    }}
                >
                    {isLoading ? 'Creating Invoice...' : 'Confirm Deposit'}
                </Button>
                <Button
                    bg="$gray3"
                    color="$color"
                    size="$5"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onBack();
                    }}
                >
                    Go Back
                </Button>
            </YStack>

            <ProcessingSheet
                visible={!!isLoading}
                title="Creating Invoice"
                amount={sats}
                detail={`Requesting from ${mintDisplayName}`}
            />
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
