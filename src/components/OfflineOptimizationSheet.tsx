import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { YStack, XStack, Text, Button, Separator, View, ScrollView } from 'tamagui';
import { AlertCircle, ArrowRight, Check, Coins, ArrowLeft, EqualApproximately } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { OfflineDenominationSelector } from './OfflineDenominationSelector';
import { findClosestSubsetOptions, SubsetOption } from '~/utils/offlineSendUtils';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import * as Haptics from 'expo-haptics';

export interface OfflineOptimizationSheetRef {
    present: () => void;
    dismiss: () => void;
}

interface OfflineOptimizationSheetProps {
    targetAmount: number;
    activeMintUrl: string | null;
    onConfirm: (amount: number, proofs: any[]) => void;
}

export const OfflineOptimizationSheet = forwardRef<OfflineOptimizationSheetRef, OfflineOptimizationSheetProps>(
    ({ targetAmount, activeMintUrl, onConfirm }, ref) => {
        const sheetRef = useRef<AppBottomSheetRef>(null);
        const { primaryCurrency, secondaryCurrency } = useSettingsStore();

        // 1. Fetch bitcoin price for fiat conversions
        const { data: btcData } = useQuery({
            queryKey: ['bitcoinPrice', secondaryCurrency],
            queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
            staleTime: 30000,
        });

        const currencySymbol = useMemo(() => {
            return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
        }, [secondaryCurrency]);

        // Helper to format fiat value
        const getFiatValue = (sats: number) => {
            if (!btcData?.price) return '...';
            const val = currencyService.convertSatsToCurrency(sats, btcData.price);
            return `${currencySymbol}${val.toFixed(2)}`;
        };

        // State variables
        const [availableProofs, setAvailableProofs] = useState<any[]>([]);
        const [viewMode, setViewMode] = useState<'closest' | 'custom'>('closest');
        const [selectedOptionType, setSelectedOptionType] = useState<'lower' | 'exact' | 'higher' | null>(null);

        // Custom selection state
        const [customAmount, setCustomAmount] = useState('0');
        const [customProofs, setCustomProofs] = useState<any[]>([]);

        // 2. Load proofs from DB
        useEffect(() => {
            if (!activeMintUrl) return;

            const loadProofs = async () => {
                try {
                    const { initService } = require('~/services/core');
                    const repo = initService.getRepo();
                    const proofs = await repo.proofRepository.getAvailableProofs(activeMintUrl);
                    setAvailableProofs(proofs);
                } catch (e) {
                    console.warn('[OfflineOptimizationSheet] Failed to load proofs:', e);
                    setAvailableProofs([]);
                }
            };
            loadProofs();
        }, [activeMintUrl]);

        // 3. Calculate closest options
        const options = useMemo(() => {
            if (availableProofs.length === 0 || targetAmount <= 0) {
                return { lower: null, exact: null, higher: null, recommended: null };
            }

            const res = findClosestSubsetOptions(targetAmount, availableProofs);

            // Determine which is absolute closest (recommended)
            let recommended: 'lower' | 'exact' | 'higher' | null = null;
            if (res.exact) {
                recommended = 'exact';
            } else if (res.lower && res.higher) {
                const lowerDiff = targetAmount - res.lower.amount;
                const higherDiff = res.higher.amount - targetAmount;
                recommended = lowerDiff <= higherDiff ? 'lower' : 'higher';
            } else if (res.lower) {
                recommended = 'lower';
            } else if (res.higher) {
                recommended = 'higher';
            }

            return { ...res, recommended };
        }, [targetAmount, availableProofs]);

        // Reset state on open
        const resetState = () => {
            setViewMode('closest');
            setSelectedOptionType(options.recommended);
            setCustomAmount('0');
            setCustomProofs([]);
        };

        useImperativeHandle(ref, () => ({
            present: () => {
                resetState();
                sheetRef.current?.present();
            },
            dismiss: () => {
                sheetRef.current?.dismiss();
            }
        }));

        // Auto-select recommended option on computation
        useEffect(() => {
            if (options.recommended) {
                setSelectedOptionType(options.recommended);
            }
        }, [options.recommended]);

        const handleOptionSelect = (type: 'lower' | 'exact' | 'higher') => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedOptionType(type);
        };

        const handleConfirm = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sheetRef.current?.dismiss();

            if (viewMode === 'closest') {
                if (!selectedOptionType) return;
                const selected = options[selectedOptionType];
                if (selected) {
                    onConfirm(selected.amount, selected.proofs);
                }
            } else {
                const amt = parseInt(customAmount, 10) || 0;
                if (amt > 0 && customProofs.length > 0) {
                    onConfirm(amt, customProofs);
                }
            }
        };

        return (
            <AppBottomSheet ref={sheetRef}>
                <YStack p="$4" pt="$2" gap="$4">
                    {/* Header */}
                    {/* Header */}
                    <YStack borderBottomWidth={1} borderBottomColor="$borderColor" pb="$3" gap="$1.5">
                        <XStack items="center" justify="space-between">
                            {viewMode === 'custom' ? (
                                <Button
                                    size="$2"
                                    icon={<ArrowLeft size={16} />}
                                    onPress={() => setViewMode('closest')}
                                    chromeless
                                    p="$0"
                                >
                                    Back
                                </Button>
                            ) : (
                                <XStack justify="space-between" width="100%">

                                    <XStack gap="$2" items="center">
                                        <AlertCircle size={20} color="$orange10" />
                                        <Text fontSize="$5" fontWeight="800">Offline Optimization</Text>
                                    </XStack>
                                    <EqualApproximately color="$accent10" />

                                    <Text color="$accent3" fontSize="$5" fontWeight="800">
                                        ₿{Number(targetAmount).toLocaleString()}
                                    </Text>

                                </XStack>
                            )}
                        </XStack>


                    </YStack>

                    {viewMode === 'closest' ? (
                        <YStack gap="$4">
                            <Text color="$gray10" fontSize="$3" textAlign="center" px="$2">
                                We are offline. Choose a possible sat amount close to your target or select coins manually.
                            </Text>

                            <YStack gap="$3">
                                {/* Option A: Lower Closest */}
                                {options.lower && !options.exact && (
                                    <XStack
                                        borderWidth={selectedOptionType === 'lower' ? 2 : 1}
                                        borderColor={selectedOptionType === 'lower' ? "#007AFF" : "$color4"}
                                        p="$4"
                                        rounded="$4"
                                        bg={selectedOptionType === 'lower' ? "#007AFF" : "$color3"}
                                        justify="space-between"
                                        items="center"
                                        onPress={() => handleOptionSelect('lower')}
                                        pressStyle={{ opacity: 0.8 }}
                                    >
                                        <YStack gap="$1.5">
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$3" fontWeight="600" color={selectedOptionType === 'lower' ? "white" : "$gray10"}>Send Less</Text>
                                                {options.recommended === 'lower' && (
                                                    <Text fontSize="$1" fontWeight="800" bg={selectedOptionType === 'lower' ? "rgba(255, 255, 255, 0.25)" : "$accent5"} color={selectedOptionType === 'lower' ? "white" : "$accent10"} px="$2" py="$0.5" rounded="$2">
                                                        NEAREST
                                                    </Text>
                                                )}
                                            </XStack>
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$5" fontWeight="800" color={selectedOptionType === 'lower' ? "white" : "$color"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(targetAmount) : `₿${targetAmount}`}
                                                </Text>
                                                <ArrowRight size={14} color={selectedOptionType === 'lower' ? "white" : "$gray10"} />
                                                <Text fontSize="$5" fontWeight="900" color={selectedOptionType === 'lower' ? "white" : "$color"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(options.lower.amount) : `₿${options.lower.amount} sats`}
                                                </Text>
                                            </XStack>
                                            <Text fontSize="$2" color={selectedOptionType === 'lower' ? "rgba(255, 255, 255, 0.7)" : "$gray10"}>
                                                {primaryCurrency === 'FIAT' ? `₿${options.lower.amount} sats` : getFiatValue(options.lower.amount)} &bull; -{targetAmount - options.lower.amount} sats difference
                                            </Text>
                                        </YStack>
                                        <View
                                            width={24}
                                            height={24}
                                            rounded="$10"
                                            borderWidth={2}
                                            borderColor={selectedOptionType === 'lower' ? "white" : "$gray8"}
                                            bg={selectedOptionType === 'lower' ? "white" : "transparent"}
                                            items="center"
                                            justify="center"
                                        >
                                            {selectedOptionType === 'lower' && <Check size={14} color="#007AFF" strokeWidth={3} />}
                                        </View>
                                    </XStack>
                                )}

                                {/* Option B: Exact Match */}
                                {options.exact && (
                                    <XStack
                                        borderWidth={selectedOptionType === 'exact' ? 2 : 1}
                                        borderColor={selectedOptionType === 'exact' ? "#007AFF" : "$color4"}
                                        p="$4"
                                        rounded="$4"
                                        bg={selectedOptionType === 'exact' ? "#007AFF" : "$color3"}
                                        justify="space-between"
                                        items="center"
                                        onPress={() => handleOptionSelect('exact')}
                                        pressStyle={{ opacity: 0.8 }}
                                    >
                                        <YStack gap="$1.5">
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$3" fontWeight="600" color={selectedOptionType === 'exact' ? "white" : "$gray10"}>Exact Match</Text>
                                                <Text fontSize="$1" fontWeight="800" bg={selectedOptionType === 'exact' ? "rgba(255, 255, 255, 0.25)" : "$green5"} color={selectedOptionType === 'exact' ? "white" : "$green10"} px="$2" py="$0.5" rounded="$2">
                                                    PERFECT
                                                </Text>
                                            </XStack>
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$5" fontWeight="800" color={selectedOptionType === 'exact' ? "white" : "$color"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(targetAmount) : `₿${targetAmount}`}
                                                </Text>
                                                <ArrowRight size={14} color={selectedOptionType === 'exact' ? "white" : "$gray10"} />
                                                <Text fontSize="$5" fontWeight="900" color={selectedOptionType === 'exact' ? "white" : "$green10"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(options.exact.amount) : `₿${options.exact.amount} sats`}
                                                </Text>
                                            </XStack>
                                            <Text fontSize="$2" color={selectedOptionType === 'exact' ? "rgba(255, 255, 255, 0.7)" : "$gray10"}>
                                                {primaryCurrency === 'FIAT' ? `₿${options.exact.amount} sats` : getFiatValue(options.exact.amount)} &bull; Exact subset sum available
                                            </Text>
                                        </YStack>
                                        <View
                                            width={24}
                                            height={24}
                                            rounded="$10"
                                            borderWidth={2}
                                            borderColor={selectedOptionType === 'exact' ? "white" : "$gray8"}
                                            bg={selectedOptionType === 'exact' ? "white" : "transparent"}
                                            items="center"
                                            justify="center"
                                        >
                                            {selectedOptionType === 'exact' && <Check size={14} color="#007AFF" strokeWidth={3} />}
                                        </View>
                                    </XStack>
                                )}

                                {/* Option C: Higher Closest */}
                                {options.higher && !options.exact && (
                                    <XStack
                                        borderWidth={selectedOptionType === 'higher' ? 2 : 1}
                                        borderColor={selectedOptionType === 'higher' ? "#007AFF" : "$color4"}
                                        p="$4"
                                        rounded="$4"
                                        bg={selectedOptionType === 'higher' ? "#007AFF" : "$color3"}
                                        justify="space-between"
                                        items="center"
                                        onPress={() => handleOptionSelect('higher')}
                                        pressStyle={{ opacity: 0.8 }}
                                    >
                                        <YStack gap="$1.5">
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$3" fontWeight="600" color={selectedOptionType === 'higher' ? "white" : "$gray10"}>Send More</Text>
                                                {options.recommended === 'higher' && (
                                                    <Text fontSize="$1" fontWeight="800" bg={selectedOptionType === 'higher' ? "rgba(255, 255, 255, 0.25)" : "$accent5"} color={selectedOptionType === 'higher' ? "white" : "$accent10"} px="$2" py="$0.5" rounded="$2">
                                                        NEAREST
                                                    </Text>
                                                )}
                                            </XStack>
                                            <XStack items="center" gap="$2">
                                                <Text fontSize="$5" fontWeight="800" color={selectedOptionType === 'higher' ? "white" : "$color"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(targetAmount) : `₿${targetAmount}`}
                                                </Text>
                                                <ArrowRight size={14} color={selectedOptionType === 'higher' ? "white" : "$gray10"} />
                                                <Text fontSize="$5" fontWeight="900" color={selectedOptionType === 'higher' ? "white" : "$color"}>
                                                    {primaryCurrency === 'FIAT' ? getFiatValue(options.higher.amount) : `₿${options.higher.amount} sats`}
                                                </Text>
                                            </XStack>
                                            <Text fontSize="$2" color={selectedOptionType === 'higher' ? "rgba(255, 255, 255, 0.7)" : "$gray10"}>
                                                {primaryCurrency === 'FIAT' ? `₿${options.higher.amount} sats` : getFiatValue(options.higher.amount)} &bull; +{options.higher.amount - targetAmount} sats difference
                                            </Text>
                                        </YStack>
                                        <View
                                            width={24}
                                            height={24}
                                            rounded="$10"
                                            borderWidth={2}
                                            borderColor={selectedOptionType === 'higher' ? "white" : "$gray8"}
                                            bg={selectedOptionType === 'higher' ? "white" : "transparent"}
                                            items="center"
                                            justify="center"
                                        >
                                            {selectedOptionType === 'higher' && <Check size={14} color="#007AFF" strokeWidth={3} />}
                                        </View>
                                    </XStack>
                                )}
                            </YStack>

                            {/* Link to manual coin selection */}
                            <Button
                                icon={<Coins size={16} />}
                                size="$4"
                                chromeless
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setViewMode('custom');
                                }}
                            >
                                Select Coins Manually...
                            </Button>

                            <Button
                                theme="accent"
                                size="$5"
                                rounded="$4"
                                onPress={handleConfirm}
                                disabled={!selectedOptionType}
                            >
                                Confirm & Continue
                            </Button>
                        </YStack>
                    ) : (
                        <YStack flex={1} minHeight={350} gap="$2">
                            <OfflineDenominationSelector
                                activeMintUrl={activeMintUrl}
                                amount={customAmount}
                                setAmount={setCustomAmount}
                                onSelectedProofsChange={setCustomProofs}
                                onContinue={handleConfirm}
                            />
                        </YStack>
                    )}
                </YStack>
            </AppBottomSheet>
        );
    }
);
OfflineOptimizationSheet.displayName = 'OfflineOptimizationSheet';
