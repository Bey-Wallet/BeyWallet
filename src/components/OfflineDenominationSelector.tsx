import React, { useState, useEffect, useMemo } from 'react';
import { YStack, XStack, Text, Button, ScrollView } from 'tamagui';
import { AlertCircle, Plus, Minus } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import * as Haptics from 'expo-haptics';

interface OfflineDenominationSelectorProps {
    activeMintUrl: string | null;
    amount: string;
    setAmount: (val: string) => void;
    onSelectedProofsChange: (proofs: any[]) => void;
    onContinue: () => void;
    isContinueDisabled?: boolean;
}

export function OfflineDenominationSelector({
    activeMintUrl,
    amount,
    setAmount,
    onSelectedProofsChange,
    onContinue,
    isContinueDisabled = false
}: OfflineDenominationSelectorProps) {
    const [availableProofs, setAvailableProofs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selections, setSelections] = useState<Record<number, number>>({});

    // 1. Fetch available proofs when mint changes
    useEffect(() => {
        if (!activeMintUrl) return;

        const loadProofs = async () => {
            setLoading(true);
            try {
                const { initService } = require('~/services/core');
                const repo = initService.getRepo();
                const proofs = await repo.proofRepository.getAvailableProofs(activeMintUrl);
                setAvailableProofs(proofs);
            } catch (e) {
                console.warn('[OfflineDenominationSelector] Failed to load offline proofs:', e);
                setAvailableProofs([]);
            } finally {
                setLoading(false);
            }
        };

        loadProofs();
    }, [activeMintUrl]);

    // 2. Reset selections when available proofs or mint changes
    useEffect(() => {
        setSelections({});
        setAmount('0');
    }, [activeMintUrl, availableProofs]);

    // 3. Group available proofs by denomination
    const denominationGroups = useMemo(() => {
        const groupsMap: Record<number, any[]> = {};
        for (const p of availableProofs) {
            if (!groupsMap[p.amount]) {
                groupsMap[p.amount] = [];
            }
            groupsMap[p.amount].push(p);
        }

        // Sort ascending (smallest denominations first)
        return Object.keys(groupsMap)
            .map(Number)
            .sort((a, b) => a - b)
            .map(amount => ({
                amount,
                proofs: groupsMap[amount]
            }));
    }, [availableProofs]);

    // 4. Calculate total selected and list of selected proofs
    const { totalSelected, selectedProofsList } = useMemo(() => {
        let total = 0;
        const list: any[] = [];
        for (const group of denominationGroups) {
            const count = selections[group.amount] || 0;
            total += group.amount * count;
            list.push(...group.proofs.slice(0, count));
        }
        return { totalSelected: total, selectedProofsList: list };
    }, [selections, denominationGroups]);

    // 5. Update amount and proofs in parent
    useEffect(() => {
        setAmount(String(totalSelected));
    }, [totalSelected]);

    useEffect(() => {
        onSelectedProofsChange(selectedProofsList);
    }, [selectedProofsList]);

    // 6. Handlers
    const handleIncrement = (denom: number, limit: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelections(prev => {
            const current = prev[denom] || 0;
            if (current >= limit) return prev;
            return {
                ...prev,
                [denom]: current + 1
            };
        });
    };

    const handleDecrement = (denom: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelections(prev => {
            const current = prev[denom] || 0;
            if (current <= 0) return prev;
            return {
                ...prev,
                [denom]: current - 1
            };
        });
    };

    const handleQuickSelectAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const allSelections: Record<number, number> = {};
        for (const group of denominationGroups) {
            allSelections[group.amount] = group.proofs.length;
        }
        setSelections(allSelections);
    };

    const handleClearAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelections({});
    };

    if (loading) {
        return (
            <YStack height={200} items="center" justify="center">
                <Spinner size="medium" />
            </YStack>
        );
    }

    if (availableProofs.length === 0) {
        return (
            <YStack bg="$red3" p="$4" rounded="$4" items="center" justify="center" gap="$2" borderWidth={1} borderColor="$red7" my="$2">
                <AlertCircle size={24} color="$red10" />
                <Text color="$red10" fontWeight="700" textAlign="center">No offline funds available</Text>
                <Text color="$gray10" fontSize="$2" textAlign="center">You do not have any unspent proofs for this mint to send offline.</Text>
            </YStack>
        );
    }

    return (
        <YStack gap="$3" width="100%" flex={1} pb="$4" pt="$2">
            <XStack justify="space-between" items="center" px="$2" gap="$2">
                <Text color="$gray10" fontSize="$2" flex={1} numberOfLines={1}>
                    Select tokens:
                </Text>
                <XStack gap="$1" items="center">
                    <Button size="$2" chromeless onPress={handleQuickSelectAll} px="$2">
                        Select All
                    </Button>
                    {totalSelected > 0 && (
                        <Button size="$2" chromeless onPress={handleClearAll} theme="red" px="$2">
                            Clear
                        </Button>
                    )}
                </XStack>
            </XStack>

            <ScrollView flex={1} width="100%" space="$2" showsVerticalScrollIndicator={true}>
                {denominationGroups.map(group => {
                    const selectedCount = selections[group.amount] || 0;
                    const availableCount = group.proofs.length;
                    const isFullySelected = selectedCount === availableCount;

                    return (
                        <XStack
                            key={group.amount}
                            justify="space-between"
                            items="center"
                            p="$3"
                            bg="$color3"
                            rounded="$4"
                            borderWidth={1}
                            borderColor={selectedCount > 0 ? "$accent8" : "$color4"}
                        >
                            <YStack gap="$1">
                                <Text fontSize="$4" fontWeight="800" color={selectedCount > 0 ? "$accent10" : "$color"}>
                                    ₿{group.amount} sat{group.amount > 1 ? 's' : ''}
                                </Text>
                                <Text fontSize="$2" color="$gray10">
                                    {availableCount - selectedCount} remaining ({availableCount} total)
                                </Text>
                            </YStack>

                            <XStack gap="$3" items="center">
                                <Button
                                    circular
                                    size="$3"
                                    bg="$gray5"
                                    onPress={() => handleDecrement(group.amount)}
                                    disabled={selectedCount === 0}
                                    disabledStyle={{ opacity: 0.3 }}
                                >
                                    <Minus size={14} />
                                </Button>
                                <Text fontSize="$5" fontWeight="800" minWidth={24} textAlign="center">
                                    {selectedCount}
                                </Text>
                                <Button
                                    circular
                                    size="$3"
                                    bg={isFullySelected ? "$gray5" : "$accent5"}
                                    onPress={() => handleIncrement(group.amount, availableCount)}
                                    disabled={isFullySelected}
                                    disabledStyle={{ opacity: 0.3 }}
                                >
                                    <Plus size={14} />
                                </Button>
                            </XStack>
                        </XStack>
                    );
                })}
            </ScrollView>

            <Button
                theme="accent"
                size="$5"
                mt="$2"
                rounded="$4"
                onPress={onContinue}
                disabled={totalSelected === 0 || isContinueDisabled}
            >
                Continue (Offline)
            </Button>
        </YStack>
    );
}
