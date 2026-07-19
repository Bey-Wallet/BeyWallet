import React, { useMemo, useRef } from 'react';
import { YStack, XStack, Text, H1, Button, Avatar, Square } from "tamagui";
import { ArrowUpDown } from "@tamagui/lucide-icons";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { MintSelectorSheet } from "~/components/HomeMintSelector";
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { Spinner } from "~/components/UI/Spinner";
import * as Haptics from "expo-haptics";
import { BouncyAmount } from "~/components/UI/BouncyAmount";
import { MintBalanceRow } from "~/components/UI/MintBalanceRow";

interface AmountStageProps {
    amount: string;
    setAmount: (val: string) => void;
    onContinue: () => void;
}

export function AmountStage({ amount, setAmount, onContinue }: AmountStageProps) {
    const { activeMintUrl, mints, refreshMintList, isInitializing, isRefreshing, balance } = useWalletStore();
    const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
    const [inputMode, setInputMode] = React.useState<'SATS' | 'FIAT'>(primaryCurrency);
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const isLoadingMint = isInitializing || isRefreshing;

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = useMemo(() => {
        return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
    }, [secondaryCurrency]);

    const activeMint = useMemo(() => {
        if (!activeMintUrl) return null;
        const normalizeUrl = (url: string) => url.replace(/\/$/, "");
        return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
    }, [mints, activeMintUrl]);

    const displayName = useMemo(() => {
        if (!activeMintUrl) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, activeMintUrl]);

    // Value derived for the non-active mode
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

    // To prevent numeric jitter when typing fiat, we keep a local string for the keypad
    const [localInputValue, setLocalInputValue] = React.useState(amount);

    React.useEffect(() => {
        if (inputMode === 'SATS') {
            setLocalInputValue(amount);
        }
    }, [amount, inputMode]);

    const onKeypadChange = (rawVal: string) => {
        let val = rawVal;

        // 1. If starting with a decimal point, prepend '0'
        if (val === '.') {
            val = '0.';
        }

        // 2. In SATS mode, satoshis are whole integers — do not allow decimal points
        if (inputMode === 'SATS') {
            val = val.replace(/\./g, '');
        } else {
            // FIAT mode: prevent multiple decimals (e.g., "12.3.4" -> "12.34")
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limit to max 2 decimal places in FIAT mode (e.g., "12.345" -> "12.34")
            if (parts.length === 2 && parts[1].length > 2) {
                val = parts[0] + '.' + parts[1].slice(0, 2);
            }
        }

        // 3. Prevent multiple leading zeros (e.g. "00" -> "0", but keep "0.")
        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
            val = val.replace(/^0+/, '');
            if (val === '') val = '0';
        }

        // 4. Limit total input character length so it stays clean
        const maxLen = 11;
        if (val.length > maxLen) {
            val = val.slice(0, maxLen);
        }

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

    const formattedDisplayValue = useMemo(() => {
        if (!localInputValue || localInputValue === '0') return '0';
        if (inputMode === 'SATS') {
            const num = Number(localInputValue);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US');
            }
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

    // Dynamic font size based on string length to scale seamlessly
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
            <YStack items="center" gap="$1.5" width="100%">
                {/* Mint Selector Row */}
                <MintBalanceRow
                    activeMint={activeMint}
                    activeMintUrl={activeMintUrl || undefined}
                    displayName={displayName}
                    balance={balance}
                    isLoadingMint={isLoadingMint}
                    isSelector={true}
                    onPress={() => {
                        refreshMintList();
                        sheetRef.current?.present();
                    }}
                />

                {/* Card Box Container */}
                <YStack
                    width="100%"
                    bg="$gray3"
                    rounded="$6"
                    p="$4"
                    items="center"
                    gap="$3"
                    borderWidth={0}
                    borderColor="$borderColor"
                >

                    {/* Amount Display Section */}
                    <YStack items="center" justify="center" py="$4" gap="$2" width="100%">
                        <Text color="$gray10" fontSize="$3" fontWeight="500">
                            Enter Amount
                        </Text>

                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
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
                 {/* 3 Preset buttons above numpad */}
                <XStack width="100%" justify="center" gap="$1.5" >
                    <Button flex={1} size="$6" rounded="$6" bg="$gray3" pressStyle={{ scale: 0.95 }} onPress={() => handlePreset('1000')}>1k</Button>
                    <Button flex={1} size="$6" rounded="$6" bg="$gray3" pressStyle={{ scale: 0.95 }} onPress={() => handlePreset('5000')}>5k</Button>
                    <Button flex={1} size="$6" rounded="$6" bg="$gray3" pressStyle={{ scale: 0.95 }} onPress={() => handlePreset('20000')}>20k</Button>
                </XStack>
            </YStack>
            

            {/* Presets and Numeric Keypad */}
            <YStack width="100%" gap="$4">
           

                <NumericKeypad
                    showAmountDisplay={false}
                    value={localInputValue}
                    onValueChange={onKeypadChange}
                    onConfirm={onContinue}
                    confirmLabel="Continue"
                />
            </YStack>

            <MintSelectorSheet ref={sheetRef} />
        </YStack>
       
    );
}
