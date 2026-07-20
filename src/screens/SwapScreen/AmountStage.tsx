import React, { useRef, useMemo, useState, useEffect } from 'react';
import { YStack, XStack, Text, Button, View } from "tamagui";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { ProcessingSheet } from "~/components/UI/ProcessingSheet";
import * as Haptics from "expo-haptics";
import { ArrowUpDown } from "@tamagui/lucide-icons";
import { MintSelectorSheet } from "~/components/HomeMintSelector";
import { MintBalanceRow } from "~/components/UI/MintBalanceRow";
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { BouncyAmount } from "~/components/UI/BouncyAmount";

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
    const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);

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

    const normalizeUrl = (url: string) => url.replace(/\/$/, "");

    const sourceMint = useMemo(() => {
        if (!sourceMintUrl) return null;
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(sourceMintUrl));
    }, [mints, sourceMintUrl]);

    const targetMint = useMemo(() => {
        if (!targetMintUrl) return null;
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(targetMintUrl));
    }, [mints, targetMintUrl]);

    const sourceDisplayName = useMemo(() => {
        if (!sourceMintUrl) return "Select Mint";
        if (sourceMint?.nickname) return sourceMint.nickname;
        if (sourceMint?.name) return sourceMint.name;
        return sourceMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [sourceMint, sourceMintUrl]);

    const targetDisplayName = useMemo(() => {
        if (!targetMintUrl) return "Select Mint";
        if (targetMint?.nickname) return targetMint.nickname;
        if (targetMint?.name) return targetMint.name;
        return targetMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [targetMint, targetMintUrl]);

    const sourceBalance = sourceMintUrl ? (balances[sourceMintUrl] || 0) : 0;
    const targetBalance = targetMintUrl ? (balances[targetMintUrl] || 0) : 0;
    const isOverBalance = Number(amount) > sourceBalance;

    const handleFlipMints = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const temp = sourceMintUrl;
        setSourceMintUrl(targetMintUrl);
        setTargetMintUrl(temp);
    };

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
            return currencyService.formatSats(sats);
        }
    }, [amount, btcData?.price, inputMode, secondaryCurrency]);

    const [localInputValue, setLocalInputValue] = useState(amount);

    useEffect(() => {
        if (inputMode === 'SATS') {
            setLocalInputValue(amount);
        }
    }, [amount, inputMode]);

    const onKeypadChange = (rawVal: string) => {
        let val = rawVal;

        if (val === '.') val = '0.';

        if (inputMode === 'SATS') {
            val = val.replace(/\./g, '');
        } else {
            const parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
            if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].slice(0, 2);
        }

        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
            val = val.replace(/^0+/, '');
            if (val === '') val = '0';
        }

        const maxLen = 11;
        if (val.length > maxLen) val = val.slice(0, maxLen);

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

    const formattedDisplayValue = useMemo(() => {
        if (!localInputValue || localInputValue === '0') return '0';
        if (inputMode === 'SATS') {
            const num = Number(localInputValue);
            if (!isNaN(num)) return num.toLocaleString('en-US');
        } else {
            const parts = localInputValue.split('.');
            const integerPart = Number(parts[0]);
            if (!isNaN(integerPart)) {
                const formattedInt = integerPart.toLocaleString('en-US');
                return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
            }
        }
        return localInputValue;
    }, [localInputValue, inputMode]);

    const dynamicFontSize = useMemo(() => {
        const len = formattedDisplayValue.length;
        if (len <= 6) return 44;
        if (len <= 8) return 38;
        if (len <= 10) return 32;
        if (len <= 13) return 26;
        return 20;
    }, [formattedDisplayValue]);

    return (
        <YStack flex={1} justify="space-between">
            <YStack gap="$1.5" width="100%">
                {/* Source Mint Selector */}
                <MintBalanceRow
                    activeMint={sourceMint}
                    activeMintUrl={sourceMintUrl}
                    displayName={sourceDisplayName}
                    label="From Mint"
                    balance={sourceBalance}
                    isSelector={true}
                    onPress={() => sourceSheetRef.current?.present()}
                    showMax={false}
                />

                {/* Amount Display Card */}
                <YStack
                    width="100%"
                    bg="$gray3"
                    rounded="$6"
                    p="$4"
                    items="center"
                    gap="$2"
                >
                    <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
                        {error || isOverBalance ? (
                            <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                                {error || "Exceeds available balance"}
                            </Text>
                        ) : (
                            <Text color="$gray10" fontSize="$3" fontWeight="500">
                                How much to swap?
                            </Text>
                        )}

                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                            color={isOverBalance ? "$red10" : "$color"}
                        />

                        <Button
                            size="$3"
                            rounded="$10"
                            bg="$gray3"
                            pressStyle={{ scale: 0.96, bg: "$gray5" }}
                            onPress={toggleMode}
                            iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
                        >
                            <Text fontSize="$5" fontWeight="600" color="$accent10">
                                {conversionValue}
                            </Text>
                        </Button>
                    </YStack>
                </YStack>

                {/* Target Mint Selector */}
                <MintBalanceRow
                    activeMint={targetMint}
                    activeMintUrl={targetMintUrl}
                    displayName={targetDisplayName}
                    label="To Mint"
                    balance={targetBalance}
                    isSelector={true}
                    onPress={() => targetSheetRef.current?.present()}
                    showMax={false}
                />
            </YStack>

            {/* Numeric Keypad */}
            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel="Review Swap"
                maxAmount={sourceBalance}
                confirmDisabled={
                    !sourceMintUrl || !targetMintUrl ||
                    sourceMintUrl === targetMintUrl ||
                    !amount || Number(amount) <= 0 ||
                    Number(amount) > sourceBalance
                }
            />

            <MintSelectorSheet ref={sourceSheetRef} activeMintUrl={sourceMintUrl} changeGlobalActiveMint={false} onSelect={setSourceMintUrl} />
            <MintSelectorSheet ref={targetSheetRef} activeMintUrl={targetMintUrl} changeGlobalActiveMint={false} onSelect={setTargetMintUrl} />
            <ProcessingSheet
                visible={!!isLoading}
                title="Swapping"
                amount={Number(amount)}
                detail={`From ${sourceDisplayName} to ${targetDisplayName}`}
            />
        </YStack>
    );
}
