import React, { useEffect, useMemo } from 'react';
import { YStack, XStack, Text, Button, H1, Separator, Avatar } from "tamagui";
import { CheckCircle2, XCircle, AlertCircle, Sprout, Zap } from "@tamagui/lucide-icons";
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

    useEffect(() => {
        if (isSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (status === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [status, isSuccess]);

    const statusTitle = useMemo(() => {
        switch (status) {
            case 'success': return 'Deposit Successful';
            case 'error': return 'Deposit Failed';
            case 'cancelled': return 'Deposit Cancelled';
        }
    }, [status]);

    const statusColor = useMemo(() => {
        switch (status) {
            case 'success': return '$green11';
            case 'error': return '$red10';
            case 'cancelled': return '$orange10';
        }
    }, [status]);

    const statusBg = useMemo(() => {
        switch (status) {
            case 'success': return '$green3';
            case 'error': return '$red3';
            case 'cancelled': return '$orange3';
        }
    }, [status]);

    const StatusIcon = useMemo(() => {
        switch (status) {
            case 'success': return <CheckCircle2 size={22} color="$green11" />;
            case 'error': return <XCircle size={22} color="$red10" />;
            case 'cancelled': return <AlertCircle size={22} color="$orange10" />;
        }
    }, [status]);

    const formattedSatsString = useMemo(() => {
        return sats.toLocaleString('en-US');
    }, [sats]);

    const dynamicFontSize = useMemo(() => {
        const len = formattedSatsString.length + 2;
        if (len <= 6) return 44;
        if (len <= 8) return 38;
        if (len <= 10) return 32;
        if (len <= 13) return 26;
        return 20;
    }, [formattedSatsString]);

    const timeString = useMemo(() => {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    return (
        <YStack flex={1} justify="space-between">
            <YStack gap="$4" width="100%">
                {/* Hero Card Box Container matching ConfirmStage */}
                <YStack
                    width="100%"
                    bg="$gray2"
                    rounded="$5"
                    p="$4"
                    items="center"
                    gap="$3"
                    borderWidth={0}
                >
                    {/* Status badge at top of card */}
                    <XStack justify="center" items="center" width="100%">
                        <XStack bg={statusBg} px="$3" py="$1.5" rounded="$10" items="center" gap="$2">
                            {StatusIcon}
                            <Text fontSize="$3" fontWeight="700" color={statusColor}>
                                {statusTitle}
                            </Text>
                        </XStack>
                    </XStack>

                    {/* Amount Display Section */}
                    <YStack items="center" justify="center" py="$4" gap="$1" width="100%">
                        <Text color="$gray10" fontSize="$3" fontWeight="500">
                            {isSuccess ? 'Minted Amount' : 'Attempted Amount'}
                        </Text>

                        <H1
                            fontSize={dynamicFontSize}
                            fontVariant={['tabular-nums']}
                            fontWeight="700"
                            letterSpacing={-1}
                            py="$2"
                            color={isSuccess ? "$green11" : statusColor}
                            text="center"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ maxWidth: '100%', overflow: 'hidden' }}
                        >
                            {isSuccess ? '+' : ''}{currencyService.formatSats(sats)}
                        </H1>

                        <Text fontSize="$3" fontWeight="600" color="$accent10">
                            ≈ {fiatValue} {secondaryCurrency}
                        </Text>
                    </YStack>
                </YStack>

                {/* Detailed Breakdown Card matching ConfirmStage */}
                <YStack bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                    <DetailItem
                        label="Status"
                        value={isSuccess ? 'Completed' : status === 'error' ? 'Failed' : 'Cancelled'}
                        valueColor={statusColor}
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
                        value={`${formattedSatsString} SATS`}
                    />
                    <DetailItem
                        label="Amount (Fiat)"
                        value={`${fiatValue}`}
                    />
                    <DetailItem
                        label="Time"
                        value={timeString}
                    />
                </YStack>
            </YStack>

            {/* Action Button at bottom */}
            <YStack pb="$2">
                <Button
                    theme={isSuccess ? "accent" : "gray"}
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
