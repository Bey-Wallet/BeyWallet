import React, { useRef, useMemo, useState, useEffect } from 'react';
import { YStack, XStack, Text, H1, View, Button } from "tamagui";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { ProcessingSheet } from "~/components/UI/ProcessingSheet";
import * as Haptics from "expo-haptics";
import { ChevronDown, ArrowDownCircle, ArrowUpRight } from "@tamagui/lucide-icons";
import { MintSelectorSheet } from "~/components/HomeMintSelector";
import { NumericKeypad } from "~/components/UI/NumericKeypad";

interface AmountStageProps {
    amount: string;
    setAmount: (val: string) => void;
    sourceMintUrl: string;
    setSourceMintUrl: (val: string) => void;
    targetMintUrl: string;
    setTargetMintUrl: (val: string) => void;
    onContinue: () => void;
    isLoading?: boolean;
    error?: string | null;
}

export function AmountStage({
    amount, setAmount,
    sourceMintUrl, setSourceMintUrl,
    targetMintUrl, setTargetMintUrl,
    onContinue, isLoading, error
}: AmountStageProps) {
    const { mints, balances } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>('SATS');

    // Bottom sheets for picking source/target mints
    const sourceSheetRef = useRef<AppBottomSheetRef>(null);
    const targetSheetRef = useRef<AppBottomSheetRef>(null);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = useMemo(() => {
        return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
    }, [secondaryCurrency]);

    const getMintLabel = (url: string) => {
        if (!url) return "Select Mint";
        const mint = mints.find(m => m.mintUrl.replace(/\/$/, '') === url.replace(/\/$/, ''));
        return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    };

    const sourceBalance = sourceMintUrl ? (balances[sourceMintUrl] || 0) : 0;

    const conversionValue = useMemo(() => {
        if (!btcData?.price) return '0';
        if (inputMode === 'SATS') {
            const sats = Number(amount) || 0;
            return currencyService.formatValue(
                currencyService.convertSatsToCurrency(sats, btcData.price),
                secondaryCurrency as CurrencyCode
            );
        } else {
            const sats = Number(amount) || 0;
            return `₿${sats}`;
        }
    }, [amount, btcData?.price, inputMode, secondaryCurrency]);

    const [localInputValue, setLocalInputValue] = useState(amount);

    useEffect(() => {
        if (inputMode === 'SATS') {
            setLocalInputValue(amount);
        }
    }, [amount, inputMode]);

    const onKeypadChange = (val: string) => {
        setLocalInputValue(val);
        if (inputMode === 'SATS') {
            setAmount(val);
        } else {
            if (btcData?.price) {
                const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
                setAmount(String(sats));
            }
        }
    };

    const toggleMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (inputMode === 'SATS') {
            if (btcData?.price) {
                const sats = Number(amount) || 0;
                const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
                setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
            }
            setInputMode('FIAT');
        } else {
            setLocalInputValue(amount);
            setInputMode('SATS');
        }
    };

    const handlePreset = (presetSats: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAmount(presetSats);
        if (inputMode === 'SATS') {
            setLocalInputValue(presetSats);
        } else if (btcData?.price) {
            const fiat = currencyService.convertSatsToCurrency(Number(presetSats), btcData.price);
            setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
        }
    };



    return (
        <YStack flex={1} justify="space-between">
            <YStack width="100%" rounded="$4" borderWidth={0.5} borderColor="$borderColor" justify="space-between" bg="$color2" items="center" mb="$4">
                {/* Source Mint Selector */}
                <XStack
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                        sourceSheetRef.current?.present();
                    }}
                    width="100%"
                    p="$3"
                    items="center"
                    borderBottomWidth={1}
                    borderBottomColor="$color3"
                    justify="space-between"
                    hoverStyle={{ bg: "$color3" }}
                    pressStyle={{ bg: "$color5", opacity: 0.8 }}
                    borderTopLeftRadius="$4"
                    borderTopRightRadius="$4"
                >
                    <XStack gap="$2" items="center" flex={1}>
                        <ArrowUpRight size={18} strokeWidth={2.5} color="$red10" />
                        <YStack flex={1}>
                            <Text color="$gray10" fontSize="$1" fontWeight="800" textTransform="uppercase">From Mint</Text>
                            <Text fontWeight="800" fontSize="$4" numberOfLines={1}>{getMintLabel(sourceMintUrl)}</Text>
                        </YStack>
                    </XStack>
                    <YStack items="flex-end" pr="$2">
                        <Text color="$gray10" fontSize="$2">Balance</Text>
                        <Text fontSize="$3" fontWeight="600">{sourceBalance.toLocaleString()} sats</Text>
                    </YStack>
                    <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                </XStack>

                {/* Target Mint Selector */}
                <XStack
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                        targetSheetRef.current?.present();
                    }}
                    width="100%"
                    p="$3"
                    items="center"
                    borderBottomWidth={1}
                    borderBottomColor="$color3"
                    justify="space-between"
                    hoverStyle={{ bg: "$color3" }}
                    pressStyle={{ bg: "$color5", opacity: 0.8 }}
                >
                    <XStack gap="$2" items="center" flex={1}>
                        <ArrowDownCircle size={18} strokeWidth={2.5} color="$green10" />
                        <YStack flex={1}>
                            <Text color="$gray10" fontSize="$1" fontWeight="800" textTransform="uppercase">To Mint</Text>
                            <Text fontWeight="800" fontSize="$4" numberOfLines={1}>{getMintLabel(targetMintUrl)}</Text>
                        </YStack>
                    </XStack>
                    <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                </XStack>

                <YStack items="center" gap="$1" py="$4">
                    <Text color="$gray10" fontSize="$3">How much to swap?</Text>

                    <H1 fontWeight="400" letterSpacing={-2} py="$2" color="$color">
                        {inputMode === 'SATS' ? `₿${localInputValue || '0'}` : `${currencySymbol}${localInputValue || '0'}`}
                    </H1>

                    <Button
                        size="$2.5"
                        theme="gray"
                        fontWeight="400"
                        color="$accent9"
                        mt="$-2"
                        onPress={toggleMode}
                        pressStyle={{ scale: 0.95 }}
                    >
                        {conversionValue}
                    </Button>
                </YStack>

                <XStack width="100%" p="$3" borderTopWidth={1} borderTopColor="$color3" justify="space-between" items="center" borderBottomLeftRadius="$4" borderBottomRightRadius="$4">
                    <Text color="$gray10" fontWeight="400" fontSize="$3">Presets</Text>
                    <XStack gap="$2" items="center">
                        <Button size="$2" onPress={() => handlePreset(sourceBalance.toString())}>MAX</Button>
                        <Button size="$2" onPress={() => handlePreset('1000')}>1k</Button>
                        <Button size="$2" onPress={() => handlePreset('5000')}>5k</Button>
                    </XStack>
                </XStack>
            </YStack>

            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel="Review Swap"
                maxAmount={sourceBalance}
                confirmDisabled={!sourceMintUrl || !targetMintUrl || !amount || Number(amount) <= 0 || Number(amount) > sourceBalance}
            />

            <MintSelectorSheet ref={sourceSheetRef} onSelect={setSourceMintUrl} />
            <MintSelectorSheet ref={targetSheetRef} onSelect={setTargetMintUrl} />
            <ProcessingSheet
                visible={!!isLoading}
                title="Swapping"
                amount={Number(amount)}
                detail={`Swapping from ${getMintLabel(sourceMintUrl)} to ${getMintLabel(targetMintUrl)}`}
            />
        </YStack>
    );
}
