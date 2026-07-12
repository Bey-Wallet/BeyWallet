import React, { useState, useMemo, useRef } from 'react';
import {
    YStack,
    XStack,
    Text,
    ScrollView,
    Button,
    View,
    Separator,
    useTheme,
    H1,
    Spinner,
    Avatar,
    Square,
} from 'tamagui';
import {
    Building2,
    ChevronDown,
    Zap,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    ArrowLeft,
    Sparkles,
    Sprout,
} from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useToastController } from '@tamagui/toast';
import { useWalletStore } from '~/store/walletStore';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { MintSelectorSheet } from '~/components/HomeMintSelector';
import { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { consolidationService } from '~/services/core/consolidationService';
import { proofService } from '~/services/core/proofService';
import { biometricService } from '~/services/biometricService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '~/store/settingsStore';

export default function OptimizeWalletScreen() {
    const router = useRouter();
    const theme = useTheme();
    const toast = useToastController();
    const queryClient = useQueryClient();
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const { activeMintUrl, mints, refreshBalance, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
    const [selectedMintUrl, setSelectedMintUrl] = useState(activeMintUrl || '');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const isLoadingMint = isInitializing || isRefreshing;
    const insets = useSafeAreaInsets();
    const { showBitcoinSymbol } = useSettingsStore();

    // Get selected mint metadata
    const selectedMint = useMemo(() => {
        const urlClean = selectedMintUrl.replace(/\/$/, '');
        return mints.find((m) => m.mintUrl.replace(/\/$/, '') === urlClean);
    }, [mints, selectedMintUrl]);

    const mintName = useMemo(() => {
        if (!selectedMintUrl) return 'Select Mint';
        return (
            selectedMint?.nickname ||
            selectedMint?.name ||
            selectedMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        );
    }, [selectedMint, selectedMintUrl]);

    // Fetch unspent proofs for Selected Mint
    const { data: proofs = [], refetch: refetchProofs } = useQuery({
        queryKey: ['readyProofs', selectedMintUrl],
        queryFn: () => proofService.getReadyProofs(selectedMintUrl),
        enabled: !!selectedMintUrl,
    });

    // Group proofs by denomination
    const denominationCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        proofs.forEach((p) => {
            counts[p.amount] = (counts[p.amount] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([amt, count]) => ({ amount: Number(amt), count }))
            .sort((a, b) => b.amount - a.amount);
    }, [proofs]);

    // Fetch fragmentation score & analysis
    const { data: analysis, refetch: refetchAnalysis } = useQuery({
        queryKey: ['fragmentationAnalysis', selectedMintUrl],
        queryFn: () => consolidationService.getFragmentationAnalysis(selectedMintUrl),
        enabled: !!selectedMintUrl,
    });

    const fragColor = useMemo(() => {
        if (!analysis) return '$green10';
        if (analysis.score > 60) return '$red10';
        if (analysis.score > 35) return '$orange10';
        return '$green10';
    }, [analysis]);

    const fragStatus = useMemo(() => {
        if (!analysis) return 'Low';
        if (analysis.score > 60) return 'High';
        if (analysis.score > 35) return 'Medium';
        return 'Low';
    }, [analysis]);

    const canOptimize = useMemo(() => {
        return proofs.length > 3;
    }, [proofs]);

    const handleOptimize = async () => {
        if (!selectedMintUrl) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!canOptimize) {
            toast.show('Already Optimized', { message: 'Your wallet structure is already optimal.' });
            return;
        }

        // Biometric auth gates self-swap operations
        const authed = await biometricService.authenticateAsync('Authorize wallet optimization');
        if (!authed) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsOptimizing(true);
        try {
            const result = await consolidationService.consolidateMint(selectedMintUrl);
            await refreshBalance();
            await refetchProofs();
            await refetchAnalysis();
            queryClient.invalidateQueries({ queryKey: ['readyProofs'] });
            queryClient.invalidateQueries({ queryKey: ['fragmentationAnalysis'] });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Wallet Optimized ✅',
                `Saved ${result.savedProofs} proofs!\n` +
                `Proofs reduced: ${result.before.count} → ${result.after.count}\n` +
                `Balance unchanged: ${result.after.totalAmount} sats`
            );
        } catch (err: any) {
            console.error('[OptimizeWallet] Optimization failed:', err);
            Alert.alert('Optimization Failed', err?.message || 'Could not optimize proofs.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <YStack flex={1} bg="$background" justify="space-between">
            <Stack.Screen options={{ title: 'Optimize Wallet' }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 120 }}>
                <YStack p="$4" gap="$4" flex={1}>
                    {/* Header Info Card */}
                    <YStack gap="$2" items="center" py="$2" px="$3">
                        <Sparkles size={32} color="$accent10" />
                        <Text fontSize="$6" fontWeight="800" textAlign="center" color="$color">
                            Optimize Proof Structure
                        </Text>
                        <Text fontSize="$3" color="$gray10" textAlign="center" px="$4" lineHeight={18}>
                            Consolidate many small ecash tokens into fewer, larger denominations. This makes payment transactions faster and reduces keyset overhead.
                        </Text>
                    </YStack>
                    {/* Mint Selector Pill */}
                    <XStack justify="center" items="center" width="100%">
                        <Button
                            size="$3"
                            rounded="$4"
                            bg="$blue10"
                            color="white"
                            px={isLoadingMint ? "$3" : "$1.5"}
                            borderWidth={0}
                            disabled={isLoadingMint}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                                refreshMintList();
                                sheetRef.current?.present();
                            }}
                            maxW={170}
                            pressStyle={{ scale: 0.97, opacity: 0.95, bg: "$blue11" }}
                            icon={
                                isLoadingMint ? (
                                    <Spinner size="small" color="white" />
                                ) : (
                                    <Avatar rounded="$3" size="$2">
                                        <Avatar.Image src={selectedMint?.icon} />
                                        <Avatar.Fallback
                                            backgroundColor="rgba(255,255,255,0.2)"
                                            alignItems="center"
                                            justifyContent="center"
                                        >
                                            <Sprout size={14} color="white" />
                                        </Avatar.Fallback>
                                    </Avatar>
                                )
                            }
                            iconAfter={
                                isLoadingMint ? undefined : (
                                    <Square
                                        size="$2"
                                        borderWidth={0.5}
                                        borderColor="rgba(255,255,255,0.2)"
                                        bg="rgba(255,255,255,0.15)"
                                        rounded="$3"
                                    >
                                        <ChevronDown size={16} strokeWidth={3} color="white" />
                                    </Square>
                                )
                            }
                            textProps={{
                                fontSize: "$3",
                                fontWeight: "700",
                                maxW: 110,
                                numberOfLines: 1,
                                color: "white",
                            }}
                            ellipse
                        >
                            {isLoadingMint ? "Loading..." : mintName}
                        </Button>
                    </XStack>

                    {/* Fragmentation Summary Cards */}
                    {analysis && (
                        <XStack gap="$3" width="100%">
                            <YStack items="center" gap="$1.5" px="$3" py="$4" bg="$gray2" borderWidth={1} borderColor="$borderColor" rounded="$5" flex={1}>
                                <Text fontSize="$6" fontWeight="800" color="$color">
                                    {analysis.proofCount}
                                </Text>
                                <Text fontSize="$1" color="$gray10" fontWeight="700" textTransform="uppercase" letterSpacing={0.5}>
                                    Total Proofs
                                </Text>
                            </YStack>

                            <YStack items="center" gap="$1.5" px="$3" py="$4" bg="$gray2" borderWidth={1} borderColor="$borderColor" rounded="$5" flex={1}>
                                <Text fontSize="$6" fontWeight="800" color={fragColor}>
                                    {fragStatus}
                                </Text>
                                <Text fontSize="$1" color="$gray10" fontWeight="700" textTransform="uppercase" letterSpacing={0.5}>
                                    Fragmentation
                                </Text>
                            </YStack>

                            <YStack items="center" gap="$1.5" px="$3" py="$4" bg="$gray2" borderWidth={1} borderColor="$borderColor" rounded="$5" flex={1}>
                                <Text fontSize="$6" fontWeight="800" color="$accent1">
                                    {analysis.estimatedAfterCount}
                                </Text>
                                <Text fontSize="$1" color="$gray10" fontWeight="700" textTransform="uppercase" letterSpacing={0.5}>
                                    Target Proofs
                                </Text>
                            </YStack>
                        </XStack>
                    )}

                    {/* Fully Optimized Check Banner */}
                    {!canOptimize && proofs.length > 0 && (
                        <XStack bg="$green2" borderW={1} borderColor="$green6" p="$3.5" rounded="$4" gap="$3" items="center" mx="$2">
                            <CheckCircle2 size={20} color="$green10" />
                            <YStack flex={1}>
                                <Text fontWeight="700" fontSize="$4" color="$green10">Fully Optimized</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>Your token structure is already optimal. No actions are required at this time.</Text>
                            </YStack>
                        </XStack>
                    )}

                    <Separator borderColor="$borderColor" opacity={0.3} my="$1" />

                    {/* Denomination list title */}
                    <Text fontSize="$3" color="$gray10" fontWeight="700" px="$2">
                        Denomination Breakdown
                    </Text>

                    {proofs.length === 0 ? (
                        <YStack items="center" justify="center" py="$8" gap="$2" bg="$gray2" rounded="$5">
                            <AlertCircle size={32} color="$gray8" />
                            <Text color="$gray10" fontSize="$3" fontWeight="600">
                                No ready proofs found at this mint
                            </Text>
                        </YStack>
                    ) : (
                        <ListTable>
                            {denominationCounts.map(({ amount, count }) => (
                                <ListTableRow
                                    key={amount}
                                    label={showBitcoinSymbol ? `₿${amount.toLocaleString()}` : `${amount.toLocaleString()} sats`}
                                    value={`${count} proof${count === 1 ? '' : 's'}`}
                                    icon={Zap}
                                    iconColor={amount >= 64 ? '$accent9' : '$gray10'}
                                />
                            ))}
                        </ListTable>
                    )}
                </YStack>
            </ScrollView>

            {/* Bottom Actions Area */}
            <YStack px="$4" pt="$4" pb={insets.bottom + 16} bg="$background" gap="$3" borderTopWidth={1} borderTopColor="$borderColor" opacity={isOptimizing ? 0.8 : 1}>
                {isOptimizing ? (
                    <Button size="$5" bg="$gray4" rounded="$5" disabled>
                        <XStack gap="$2" items="center">
                            <Spinner color="$color" />
                            <Text fontSize="$4" fontWeight="800" color="$color">
                                Optimizing wallet...
                            </Text>
                        </XStack>
                    </Button>
                ) : (
                    <Button
                        size="$5"
                        bg={canOptimize ? '$green10' : '$gray4'}
                        pressStyle={canOptimize ? { scale: 0.98, opacity: 0.9 } : undefined}
                        rounded="$5"
                        onPress={handleOptimize}
                        disabled={!canOptimize}
                        icon={<Sparkles size={20} color={canOptimize ? 'white' : '$gray9'} />}
                    >
                        <Text fontSize="$6" fontWeight="800" color={canOptimize ? 'white' : '$gray9'}>
                            {canOptimize ? 'Optimize Wallet' : 'Already Optimal'}
                        </Text>
                    </Button>
                )}


            </YStack>

            <MintSelectorSheet
                ref={sheetRef}
                activeMintUrl={selectedMintUrl}
                onSelect={(url) => setSelectedMintUrl(url)}
                changeGlobalActiveMint={false}
            />
        </YStack>
    );
}
