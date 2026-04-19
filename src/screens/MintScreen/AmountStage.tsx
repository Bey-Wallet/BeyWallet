import React from 'react';
import { YStack, XStack, Text, H1, ListItem, View, Button, Avatar, Square } from "tamagui";
import { RollingNumber } from "~/components/UI/RollingNumber";
import { useWalletStore } from "~/store/walletStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import AppBottomSheet, { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { useRef, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronDown, Sprout, Plus, ShieldCheck, ShieldOff } from "@tamagui/lucide-icons";
import { NumericKeypad } from "~/components/UI/NumericKeypad";

interface AmountStageProps {
    amount: string;
    setAmount: (val: string) => void;
    onContinue: () => void;
}

export function AmountStage({ amount, setAmount, onContinue }: AmountStageProps) {
    const { activeMintUrl, mints, setActiveMint } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const [inputMode, setInputMode] = React.useState<'SATS' | 'FIAT'>('SATS');
    const sheetRef = useRef<AppBottomSheetRef>(null);

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
            return `₿${sats}`;
        }
    }, [amount, btcData?.price, inputMode, secondaryCurrency]);

    const handleValueChange = (newVal: string) => {
        if (inputMode === 'SATS') {
            setAmount(newVal);
        } else {
            // Processing fiat input
            if (!btcData?.price) return;
            const fiatNum = Number(newVal) || 0;
            const sats = currencyService.convertCurrencyToSats(fiatNum, btcData.price);
            // We still need to store the fiat string somewhere to avoid conversion jitter
            // but the parent needs Sats. 
            // Let's use a local state for the keypad value to keep it clean.
            setAmount(String(sats));
        }
    };

    // To prevent numeric jitter when typing fiat, we keep a local string for the keypad
    const [localInputValue, setLocalInputValue] = React.useState(amount);

    // Synchronize local input when amount changes from outside (e.g. toggling or initial)
    // but only if we are in SATS mode. In FIAT mode, the keypad drives the local value.
    React.useEffect(() => {
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
            // Switching to FIAT
            if (btcData?.price) {
                const sats = Number(amount) || 0;
                const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
                setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
            }
            setInputMode('FIAT');
        } else {
            // Switching to SATS
            setLocalInputValue(amount);
            setInputMode('SATS');
        }
    };

    const handleSelectMint = (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
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
            <YStack width="100%" height={300} rounded="$4" borderWidth={0.5} borderColor="$borderColor" justify="space-between" bg="$color2" items="center">
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
                    pressStyle={{ bg: "$color5", opacity: 0.8, rounded: "$4" }}
                >
                    <XStack gap="$2" items="center">
                        <Sprout size={18} strokeWidth={2.5} color="$color" />
                    </XStack>
                    <Text fontWeight="800" fontSize="$4" numberOfLines={1} style={{ maxWidth: 200 }}>{mintName}</Text>
                    <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                </XStack>

                <YStack items="center" gap="$1">
                    <Text color="$gray10" fontSize="$3">How much to deposit?</Text>

                    <H1 fontWeight="400" letterSpacing={-2} py="$4" color="$color">
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

                <XStack width="100%" p="$3" borderTopWidth={1} borderTopColor="$color3" justify="space-between" items="center">
                    <Text color="$gray10" fontWeight="400" fontSize="$3">Presets</Text>
                    <XStack gap="$2" items="center">
                        <Button size="$2" onPress={() => handlePreset('1000')}>1k</Button>
                        <Button size="$2" onPress={() => handlePreset('5000')}>5k</Button>
                        <Button size="$2" onPress={() => handlePreset('20000')}>20k</Button>
                    </XStack>
                </XStack>
            </YStack>

            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel="Continue"
            />

            <AppBottomSheet ref={sheetRef} snapPoints={["50%", "85%"]}>
                <YStack p="$4" gap="$3" flex={1}>
                    <XStack justify="space-between" items="center" mb="$2">
                        <Text fontSize="$6" color="$accent5" fontWeight="bold">Select Mint</Text>
                    </XStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {mints.length === 0 ? (
                                <YStack items="center" py="$6" gap="$2">
                                    <Sprout size={40} color="$gray8" />
                                    <Text color="$gray10">No mints added yet</Text>
                                </YStack>
                            ) : (
                                mints.map((mint) => (
                                    <ListItem
                                        key={mint.mintUrl}
                                        size="$4"
                                        px="$2"
                                        hoverTheme
                                        pressTheme
                                        theme="gray"
                                        rounded="$4"
                                        borderWidth={mint.mintUrl === activeMintUrl ? 1 : 0}
                                        borderColor="$borderColor"
                                        bg={mint.mintUrl === activeMintUrl ? "$color2" : "transparent"}
                                        onPress={() => handleSelectMint(mint.mintUrl)}
                                        icon={
                                            <View
                                                bg={mint.trusted ? "$green4" : "$gray4"}
                                                p="$2"
                                                rounded="$10"
                                            >
                                                {mint.trusted ? (
                                                    <ShieldCheck size={20} color="$green10" />
                                                ) : (
                                                    <ShieldOff size={20} color="$gray10" />
                                                )}
                                            </View>
                                        }
                                        title={mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                        subTitle={mint.mintUrl.replace('https://', '')}
                                    />
                                ))
                            )}
                        </YStack>
                    </BottomSheetScrollView>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}

