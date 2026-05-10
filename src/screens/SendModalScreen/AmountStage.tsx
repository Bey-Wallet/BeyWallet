import React, { useMemo, useRef } from 'react';
import { YStack, XStack, Text, H1, Button, ListItem, View } from "tamagui";
import { ChevronDown, Sprout, AlertCircle, ShieldCheck, ShieldOff } from "@tamagui/lucide-icons";
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { Spinner } from '~/components/UI/Spinner';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

interface AmountStageProps {
    amount: string;
    setAmount: (val: string) => void;
    onContinue: () => void;
    balance: number;
    isLoading?: boolean;
    error?: string | null;
}

export function AmountStage({ amount, setAmount, onContinue, balance, isLoading, error }: AmountStageProps) {
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

    const parsedAmountSats = parseInt(amount, 10) || 0;
    const isOverBalance = parsedAmountSats > balance;
    const isValidAmount = parsedAmountSats > 0 && !isOverBalance;

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

    // Local input value state to handle fiat decimals smoothly
    const [localInputValue, setLocalInputValue] = React.useState(amount);

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
                    <Text fontWeight="800" fontSize="$4">{mintName}</Text>
                    <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                </XStack>

                <YStack items="center" gap="$1">
                    <Text color="$gray10" fontSize="$3">How much to send?</Text>

                    <H1 fontWeight="400" letterSpacing={-2} py="$4" color={isOverBalance ? "$red10" : "$color"}>
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

                    {isOverBalance && (
                        <Text color="$red10" fontSize="$2" mt="$2">Exceeds available balance</Text>
                    )}
                </YStack>

                <XStack width="100%" p="$3" borderTopWidth={1} borderTopColor="$color3" justify="space-between" items="center">
                    <Text color="$gray10" fontWeight="400" fontSize="$3">Available Balance</Text>
                    <XStack gap="$2" items="center">
                        <Text color="$gray10" fontWeight="600" fontSize="$3">₿{balance}</Text>
                        <Button
                            size="$2"
                            onPress={handleMax}
                            disabled={balance === 0}
                        >
                            Max
                        </Button>
                    </XStack>
                </XStack>
            </YStack>

            {/* Error Display */}
            {error && (
                <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mt="$4">
                    <AlertCircle size={18} color="$red10" />
                    <Text color="$red10" fontSize="$3" flex={1}>{error}</Text>
                </XStack>
            )}

            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel={isLoading ? "Processing..." : "Continue"}
                confirmDisabled={!isValidAmount || isLoading}
                confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
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
            <ProcessingSheet
                visible={!!isLoading}
                title="Processing"
                amount={parsedAmountSats}
                detail="Creating ecash tokens..."
            />
        </YStack>
    );
}

