import React, { useState, useMemo, useRef, useEffect } from 'react';
import { YStack, XStack, Text, H1, Button, Avatar, Square, Input } from "tamagui";
import { ArrowUpDown, Key, KeyRound, User } from "@tamagui/lucide-icons";
import { Clipboard as ClipboardIcon } from '@tamagui/lucide-icons';
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { Spinner } from '~/components/UI/Spinner';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { MintSelectorSheet } from '~/components/HomeMintSelector';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MintBalanceRow } from '~/components/UI/MintBalanceRow';
import { BouncyAmount } from '~/components/UI/BouncyAmount';
import { DestinationInputRow } from '~/components/UI/DestinationInputRow';

interface P2PKAmountStageProps {
    amount: string;
    setAmount: (val: string) => void;
    receiverPubkey: string;
    setReceiverPubkey: (val: string) => void;
    onContinue: () => void;
    balance: number;
    isLoading?: boolean;
    error?: string | null;
    isOffline?: boolean;
}

export function P2PKAmountStage({
    amount,
    setAmount,
    receiverPubkey,
    setReceiverPubkey,
    onContinue,
    balance,
    isLoading,
    error,
    isOffline
}: P2PKAmountStageProps) {
    const { activeMintUrl, mints, refreshMintList, isInitializing, isRefreshing, scannerResult, setScannerResult } = useWalletStore();
    const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const router = useRouter();

    const isLoadingMint = isInitializing || isRefreshing;

    // Check if we just returned from the scanner via store
    useEffect(() => {
        if (scannerResult) {
            const token = scannerResult.trim();
            setReceiverPubkey(token);
            setScannerResult(null);
        }
    }, [scannerResult, setReceiverPubkey, setScannerResult]);

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
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
    }, [mints, activeMintUrl]);

    const displayName = useMemo(() => {
        if (!activeMintUrl) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, activeMintUrl]);

    const parsedAmountSats = parseInt(amount, 10) || 0;
    const isOverBalance = parsedAmountSats > balance;

    const isInvalidPubkey = useMemo(() => {
        const val = receiverPubkey.trim();
        if (!val) return false;
        const lower = val.toLowerCase();
        const isNpub = lower.startsWith('npub1') && lower.length >= 50;
        const isHex = /^[a-fA-F0-9]{64}$/.test(lower);
        return !isNpub && !isHex;
    }, [receiverPubkey]);

    const isValidAmount = parsedAmountSats > 0 && !isOverBalance && receiverPubkey.trim().length > 0 && !isInvalidPubkey;

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

        if (val === '.') {
            val = '0.';
        }

        if (inputMode === 'SATS') {
            val = val.replace(/\./g, '');
        } else {
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
            if (parts.length === 2 && parts[1].length > 2) {
                val = parts[0] + '.' + parts[1].slice(0, 2);
            }
        }

        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
            val = val.replace(/^0+/, '');
            if (val === '') val = '0';
        }

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

    const handleMax = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const maxSats = balance.toString();
        setAmount(maxSats);
        if (inputMode === 'SATS') {
            setLocalInputValue(maxSats);
        } else if (btcData?.price) {
            const fiat = currencyService.convertSatsToCurrency(balance, btcData.price);
            setLocalInputValue(fiat.toFixed(2));
        }
    };

    const handleOpenScanner = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/(modals)/scanner',
            params: { returnTo: '/(modals)/send' }
        });
    };

    const handlePaste = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const text = await Clipboard.getStringAsync();
            if (text) {
                setReceiverPubkey(text.trim());
            }
        } catch (e) {
            console.error('Failed to paste from clipboard:', e);
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
                {/* Mint Selector & Balance Row */}
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
                                   showMax={true}
                                   onMaxPress={handleMax}
                                   maxDisabled={balance === 0}
                               />

                {/* Card Box Container */}
                <YStack
                    width="100%"
                    bg="$gray3"
                    rounded="$6"
                    p="$4"
                    py="$5"
                    items="center"
                    gap="$3"
                    borderWidth={0}
                >
                    {/* Amount Display Section */}
                    <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
                        {error || isOverBalance ? (
                            <Text color="$red10" fontSize="$3" fontWeight="600" text="center">
                                {error || "Exceeds available balance"}
                            </Text>
                        ) : (
                            <Text color="$gray10" fontSize="$3" fontWeight="500">
                                How much to send?
                            </Text>
                        )}

                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                        />
                        <Button
                            size="$3"
                            rounded="$10"
                            bg="$gray5"
                            pressStyle={{ scale: 0.96, bg: "$gray5" }}
                            onPress={toggleMode}
                            iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
                        >
                            {conversionValue}
                        </Button>
                    </YStack>
                </YStack>

                {/* NPUB / Pubkey Input Row */}
                <DestinationInputRow
                    value={receiverPubkey}
                    onChangeText={setReceiverPubkey}
                    placeholder="npub... or hex pubkey"
                    onPaste={handlePaste}
                    onScan={handleOpenScanner}
                    defaultIcon={<KeyRound size="$1.5" color="$accent5" strokeWidth={2.5} />}
                    isError={isInvalidPubkey}
                />

            </YStack>

            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel={isLoading ? "Processing..." : "Continue"}
                confirmDisabled={!isValidAmount || isLoading}
                confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
            />

            <MintSelectorSheet ref={sheetRef} />
        </YStack>
    );
}
