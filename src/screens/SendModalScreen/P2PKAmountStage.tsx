import React, { useState, useMemo, useRef, useEffect } from 'react';
import { YStack, XStack, Text, H1, Button, View, Input } from "tamagui";
import { ChevronDown, Sprout, AlertCircle, ScanLine, User } from "@tamagui/lucide-icons";
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
import { Clipboard as ClipboardIcon } from '@tamagui/lucide-icons';

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
    const { activeMintUrl, mints, setActiveMint, scannerResult, setScannerResult } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>('SATS');
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const router = useRouter();

    const [possibleAmounts, setPossibleAmounts] = React.useState<number[]>([]);
    const [loadingOffline, setLoadingOffline] = React.useState(false);
    console.log('[P2PKAmountStage] isOffline prop:', isOffline, 'possibleAmounts:', possibleAmounts.length);

    React.useEffect(() => {
        if (!isOffline || !activeMintUrl) return;
        
        const loadOfflineAmounts = async () => {
            setLoadingOffline(true);
            try {
                const { initService } = require('~/services/core');
                const repo = initService.getRepo();
                const proofs = await repo.proofRepository.getAvailableProofs(activeMintUrl);
                const { getPossibleAmounts } = require('~/utils/offlineSendUtils');
                const list = getPossibleAmounts(proofs);
                setPossibleAmounts(list);
            } catch (e) {
                console.warn('[P2PKAmountStage] Failed to load offline amounts:', e);
                setPossibleAmounts([]);
            } finally {
                setLoadingOffline(false);
            }
        };

        loadOfflineAmounts();
    }, [isOffline, activeMintUrl]);

    const handlePresetPress = (amt: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAmount(String(amt));
        setLocalInputValue(String(amt));
    };

    // Check if we just returned from the scanner via store
    useEffect(() => {
        if (scannerResult) {
            const token = scannerResult.trim();
            // A simple check could be if it starts with npub or is a long hex string
            setReceiverPubkey(token);
            // Clear the store result so it doesn't re-trigger
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
        return mints.find(m => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
    }, [mints, activeMintUrl]);

    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || "Select Mint";

    const parsedAmountSats = parseInt(amount, 10) || 0;
    const isOverBalance = parsedAmountSats > balance;
    const isValidAmount = parsedAmountSats > 0 && !isOverBalance && receiverPubkey.length > 10;

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

    const handleSelectMint = (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
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
        // The scanner returns to this modal
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

    return (
        <YStack flex={1} justify="space-between">
            <YStack width="100%" rounded="$4" borderWidth={0.5} borderColor="$borderColor" bg="$color2" mb="$4">
                {/* Mint Selector */}
                <XStack
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                        sheetRef.current?.present();
                    }}
                    width="100%"
                    p="$3"
                    items="center"
                    borderBottomWidth={1}
                    borderBottomColor="$color3"
                    justify="space-between"
                    hoverStyle={{ bg: "$color3" }}
                    pressStyle={{ bg: "$color5" }}
                >
                    <XStack gap="$2" items="center">
                        <Sprout size={18} strokeWidth={2.5} color="$color" />
                        <Text color="$gray10" fontWeight="600">From Mint</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" fontSize="$4" numberOfLines={1} style={{ maxWidth: 120 }}>{mintName}</Text>
                        <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                    </XStack>
                </XStack>

                {/* NPUB / Pubkey Input */}
                <XStack width="100%" p="$3" items="center" borderBottomWidth={1} borderBottomColor="$color3" justify="space-between">
                    <XStack gap="$2" items="center" flex={1}>
                        <User size={18} color="$gray10" />
                        <Input
                            flex={1}
                            size="$3"
                            borderWidth={0}
                            bg="transparent"
                            placeholder="npub... or hex pubkey"
                            value={receiverPubkey}
                            onChangeText={setReceiverPubkey}
                            autoCapitalize="none"
                            autoCorrect={false}
                            color="$color"
                        />
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Button
                            size="$3"
                            circular
                            icon={<ClipboardIcon size={18} />}
                            onPress={handlePaste}
                            bg="$color3"
                        />
                        <Button
                            size="$3"
                            circular
                            icon={<ScanLine size={18} />}
                            onPress={handleOpenScanner}
                            bg="$color3"
                        />
                    </XStack>
                </XStack>

                {/* Amount Display */}
                <YStack items="center" gap="$1" py="$4">
                    <Text color="$gray10" fontSize="$3">How much to send?</Text>
                    <H1 fontWeight="400" letterSpacing={-2} py="$2" color={isOverBalance ? "$red10" : "$color"}>
                        {inputMode === 'SATS' ? `₿${localInputValue || '0'}` : `${currencySymbol}${localInputValue || '0'}`}
                    </H1>
                    <Button
                        size="$2.5"
                        theme="gray"
                        fontWeight="400"
                        color="$accent9"
                        onPress={toggleMode}
                        pressStyle={{ scale: 0.95 }}
                    >
                        {conversionValue}
                    </Button>
                    {isOverBalance && (
                        <Text color="$red10" fontSize="$2" mt="$2">Exceeds available balance</Text>
                    )}
                </YStack>

                {/* Available Balance */}
                <XStack width="100%" p="$3" borderTopWidth={1} borderTopColor="$color3" justify="space-between" items="center">
                    <Text color="$gray10" fontWeight="400" fontSize="$3">Available Balance</Text>
                    <XStack gap="$2" items="center">
                        <Text color="$gray10" fontWeight="600" fontSize="$3">₿{balance}</Text>
                        <Button size="$2" onPress={handleMax} disabled={balance === 0}>Max</Button>
                    </XStack>
                </XStack>
            </YStack>

            {/* Error Display */}
            {error && (
                <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mt="$2" mb="$4">
                    <AlertCircle size={18} color="$red10" />
                    <Text color="$red10" fontSize="$3" flex={1}>{error}</Text>
                </XStack>
            )}

            {isOffline ? (
                <YStack gap="$3" width="100%" pb="$4" pt="$2">
                    <Text color="$gray10" fontSize="$2" textAlign="center" px="$4">
                        Choose a possible amount to create ecash offline (exact subset sums of your unspent proofs).
                    </Text>
                    {loadingOffline ? (
                        <YStack height={150} items="center" justify="center">
                            <Spinner size="medium" />
                        </YStack>
                    ) : possibleAmounts.length === 0 ? (
                        <YStack height={150} bg="$red3" p="$4" rounded="$4" items="center" justify="center" gap="$2" borderWidth={1} borderColor="$red7">
                            <AlertCircle size={24} color="$red10" />
                            <Text color="$red10" fontWeight="700" textAlign="center">No offline funds available</Text>
                            <Text color="$gray10" fontSize="$2" textAlign="center">You do not have any unspent proofs for this mint to send offline.</Text>
                        </YStack>
                    ) : (
                        <YStack gap="$2" width="100%">
                            <XStack flexWrap="wrap" gap="$2" justify="center" maxHeight={180} overflow="scroll" p="$1">
                                {possibleAmounts.map((amt) => (
                                    <Button
                                        key={amt}
                                        size="$3.5"
                                        width="29%"
                                        bg={amount === String(amt) ? "$accent3" : "$gray3"}
                                        borderColor={amount === String(amt) ? "$accent8" : "transparent"}
                                        borderWidth={amount === String(amt) ? 1 : 0}
                                        onPress={() => handlePresetPress(amt)}
                                    >
                                        <Text fontWeight="800" color={amount === String(amt) ? "$accent10" : "$color"}>
                                            ₿{amt}
                                        </Text>
                                    </Button>
                                ))}
                            </XStack>
                            <Button
                                theme="accent"
                                size="$5"
                                mt="$3"
                                rounded="$4"
                                onPress={onContinue}
                                disabled={!amount || amount === '0' || isOverBalance || receiverPubkey.length <= 10 || isLoading}
                            >
                                Continue (Offline)
                            </Button>
                        </YStack>
                    )}
                </YStack>
            ) : (
                <NumericKeypad
                    showAmountDisplay={false}
                    value={localInputValue}
                    onValueChange={onKeypadChange}
                    onConfirm={onContinue}
                    confirmLabel={isLoading ? "Processing..." : "Continue"}
                    confirmDisabled={!isValidAmount || isLoading}
                    confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
                />
            )}

            <MintSelectorSheet ref={sheetRef} />
        </YStack>
    );
}
