import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    YStack, XStack, Text, ScrollView, Button, View, Separator,
    Avatar, Square, Circle, useTheme
} from 'tamagui';
import {
    ChevronLeft, RefreshCw, Building2, CheckCircle2, AlertCircle,
    Clock, Trash2, Share2, ChevronDown, Check, ShieldOff,
    Database, Layers, PackageOpen, Copy, ArrowLeft, Zap, ChevronRight
} from '@tamagui/lucide-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useToastController } from '@tamagui/toast';
import { proofService } from '~/services/core';
import { useWalletStore } from '~/store/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { PendingTokenLayout } from '~/components/UI/PendingTokenLayout';
import type { CoreProof } from '~/services/core';
import { initService } from '~/services/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProofTab = 'unspent' | 'inflight' | 'spent';
type SheetStage = 'details' | 'send';

const TAB_META: Record<ProofTab, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
    unspent:  { label: 'Unspent',   icon: CheckCircle2, color: '$green10',  bg: '$green2' },
    inflight: { label: 'In-flight', icon: Clock,        color: '$orange10', bg: '$orange2' },
    spent:    { label: 'Spent',     icon: ShieldOff,    color: '$gray10',   bg: '$gray3' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateSecret(secret: string, len = 12): string {
    if (secret.length <= len) return secret;
    return secret.slice(0, 6) + '…' + secret.slice(-6);
}

function truncateKeysetId(id: string): string {
    if (!id) return '—';
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
}

function getMintLabel(mintUrl: string): string {
    return mintUrl
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .substring(0, 30);
}

// ─── DetailItem — nostr-profile.tsx style ─────────────────────────────────────

function DetailItem({
    label, value, isCopyable, copyValue, onCopy, onShare,
}: {
    label: string;
    value: string;
    isCopyable?: boolean;
    copyValue?: string;
    onCopy?: () => void;
    onShare?: () => void;
}) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
        <Text fontSize="$3" color="$gray10" fontWeight="600" style={{ flexShrink: 0, marginRight: 12 }}>{label}</Text>
            <XStack gap="$1" items="center" flex={1} justify="flex-end">
                <Text fontSize="$3" fontWeight="700" color="$color" numberOfLines={1} style={{ maxWidth: 180 }}>
                    {value}
                </Text>
                {onShare && (
                    <Button size="$2" chromeless icon={<Share2 size={14} color="$gray10" />} onPress={onShare} />
                )}
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={14} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <YStack items="center" gap="$0.5" px="$3" py="$2" bg="$gray3" rounded="$4" flex={1}>
            <Text fontSize="$6" fontWeight="900" color={color as any ?? '$color'}>{value}</Text>
            <Text fontSize="$2" color="$gray10" fontWeight="600">{label}</Text>
        </YStack>
    );
}

function ProofRow({
    proof,
    onPress,
    isLast,
}: {
    proof: CoreProof;
    onPress: (p: CoreProof) => void;
    isLast: boolean;
}) {
    const meta = TAB_META[proof.state as ProofTab] ?? TAB_META.unspent;
    const Icon = meta.icon;

    return (
        <>
            <YStack
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress(proof);
                }}
                pressStyle={{ opacity: 0.7, scale: 0.98 }}
                py="$2.5"
                px="$3"
                animation="quick"
            >
                <XStack justify="space-between" items="center">
                    <XStack gap="$3" items="center" flex={1}>
                        <View
                            width={40} height={40}
                            rounded="$4"
                            bg={meta.bg as any}
                            items="center"
                            justify="center"
                        >
                            <Icon size={18} color={meta.color as any} />
                        </View>
                        <YStack flex={1} gap="$0.5">
                            <XStack gap="$2" items="center">
                                <Text fontWeight="800" fontSize="$4" color="$color">
                                    ₿ {proof.amount.toLocaleString()}
                                </Text>
                                <XStack px="$1.5" py="$0.5" bg={meta.bg as any} rounded="$2">
                                    <Text fontSize="$1" fontWeight="800" color={meta.color as any} textTransform="uppercase">
                                        {proof.state}
                                    </Text>
                                </XStack>
                            </XStack>
                            <Text fontSize="$2" color="$gray10" fontWeight="500" numberOfLines={1}>
                                KS: {truncateKeysetId(proof.id)} · {truncateSecret(proof.secret)}
                            </Text>
                        </YStack>
                    </XStack>
                    <ChevronRight size={14} color="$gray8" />
                </XStack>
            </YStack>
            {!isLast && <Separator borderColor="$borderColor" opacity={0.4} />}
        </>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProofsModal() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { mints, refreshBalance } = useWalletStore();
    const queryClient = useQueryClient();
    const toast = useToastController();
    const theme = useTheme();

    // State
    const [activeTab, setActiveTab] = useState<ProofTab>('unspent');
    const [mintFilter, setMintFilter] = useState<string>('all');
    const [selectedProof, setSelectedProof] = useState<CoreProof | null>(null);
    const [sheetStage, setSheetStage] = useState<SheetStage>('details');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [createdToken, setCreatedToken] = useState<string | null>(null);

    // Refs
    const mintFilterSheetRef = useRef<AppBottomSheetRef>(null);
    const proofActionSheetRef = useRef<AppBottomSheetRef>(null);

    // ── Invalidate on screen focus so ecash.tsx changes reflect here ───────────
    useFocusEffect(useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['proofs'] });
        queryClient.invalidateQueries({ queryKey: ['history'] });
    }, [queryClient]));

    // ── Data fetching ──────────────────────────────────────────────────────────

    const { data: unspentProofs = [], isFetching: fetchingUnspent, refetch: refetchUnspent } = useQuery({
        queryKey: ['proofs', 'unspent'],
        queryFn: () => proofService.getAllReadyProofs(),
        staleTime: 5000,
    });

    const { data: inflightProofs = [], isFetching: fetchingInflight, refetch: refetchInflight } = useQuery({
        queryKey: ['proofs', 'inflight'],
        queryFn: () => proofService.getAllProofsByState('inflight'),
        staleTime: 5000,
    });

    const { data: spentProofs = [], isFetching: fetchingSpent, refetch: refetchSpent } = useQuery({
        queryKey: ['proofs', 'spent'],
        queryFn: () => proofService.getAllProofsByState('spent'),
        staleTime: 5000,
    });

    const isFetching = fetchingUnspent || fetchingInflight || fetchingSpent;

    const refetchAll = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Promise.all([refetchUnspent(), refetchInflight(), refetchSpent()]);
    }, [refetchUnspent, refetchInflight, refetchSpent]);

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['proofs'] });
        queryClient.invalidateQueries({ queryKey: ['history'] });
        queryClient.invalidateQueries({ queryKey: ['history', 'pending'] });
    }, [queryClient]);

    // ── Derived data ───────────────────────────────────────────────────────────

    const allProofsForTab = useMemo((): CoreProof[] => {
        const map: Record<ProofTab, CoreProof[]> = {
            unspent: unspentProofs,
            inflight: inflightProofs,
            spent: spentProofs,
        };
        return map[activeTab] ?? [];
    }, [activeTab, unspentProofs, inflightProofs, spentProofs]);

    const filteredProofs = useMemo(() => {
        if (mintFilter === 'all') return allProofsForTab;
        return allProofsForTab.filter(p =>
            p.mintUrl?.replace(/\/$/, '') === mintFilter.replace(/\/$/, '')
        );
    }, [allProofsForTab, mintFilter]);

    const totalSats = useMemo(() =>
        filteredProofs.reduce((sum, p) => sum + (p.amount || 0), 0),
        [filteredProofs]
    );

    const allMints = useMemo(() => {
        const urls = new Set([
            ...unspentProofs.map(p => p.mintUrl),
            ...inflightProofs.map(p => p.mintUrl),
            ...spentProofs.map(p => p.mintUrl),
        ]);
        return Array.from(urls).filter(Boolean);
    }, [unspentProofs, inflightProofs, spentProofs]);

    const activeMintInfo = mints.find(m => m.mintUrl === mintFilter);

    const counts: Record<ProofTab, number> = useMemo(() => ({
        unspent: unspentProofs.length,
        inflight: inflightProofs.length,
        spent: spentProofs.length,
    }), [unspentProofs, inflightProofs, spentProofs]);

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleProofPress = (proof: CoreProof) => {
        setSelectedProof(proof);
        setSheetStage('details');
        setCreatedToken(null);
        proofActionSheetRef.current?.present();
    };

    const openSendStage = async () => {
        if (!selectedProof) return;
        setIsCreatingToken(true);
        try {
            // Encode the proof as a Cashu token (offline — no swap, no mint call)
            const token = proofService.encodeProofsAsToken(
                selectedProof.mintUrl,
                [selectedProof],
                'sat'
            );

            // Mark proof as inflight instantly so it can't be double-spent from UI
            await initService.getRepo().proofRepository.setProofState(
                selectedProof.mintUrl,
                [selectedProof.secret],
                'inflight'
            );

            setCreatedToken(token);
            setSheetStage('send');

            // Invalidate all proof queries + history so ecash.tsx refreshes
            invalidateAll();
            await refreshBalance();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            Alert.alert('Failed', err?.message ?? String(err));
        } finally {
            setIsCreatingToken(false);
        }
    };

    const handleCopyToken = async () => {
        if (!createdToken) return;
        await Clipboard.setStringAsync(createdToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied!', { message: 'Token copied to clipboard' });
    };

    const handleShareToken = async () => {
        if (!createdToken) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await RNShare.share({ message: `cashu:${createdToken}` });
        } catch {
            await handleCopyToken();
        }
    };

    const handleCopyField = async (val: string, label: string) => {
        await Clipboard.setStringAsync(val);
        Haptics.selectionAsync();
        toast.show('Copied!', { message: `${label} copied` });
    };

    const handleShareField = async (val: string) => {
        try {
            await RNShare.share({ message: val });
        } catch {
            await Clipboard.setStringAsync(val);
        }
    };

    const handleDeleteProof = () => {
        if (!selectedProof) return;
        const canDelete = selectedProof.state === 'ready' || selectedProof.state === 'spent';
        if (!canDelete) {
            Alert.alert('Cannot Delete', 'In-flight proofs cannot be deleted — they may be part of an active send operation.');
            return;
        }
        Alert.alert(
            'Delete Proof?',
            `This permanently removes this ${selectedProof.amount} sat proof from your device and CANNOT be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await proofService.deleteProofs(selectedProof.mintUrl, [selectedProof.secret]);
                            proofActionSheetRef.current?.dismiss();
                            await refetchAll();
                            await refreshBalance();
                            invalidateAll();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (err: any) {
                            Alert.alert('Delete Failed', err?.message ?? String(err));
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAllSpent = () => {
        if (filteredProofs.length === 0) return;
        Alert.alert(
            `Erase ${filteredProofs.length} Spent Proofs?`,
            'Permanently deletes all shown spent proofs. Frees storage but cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Erase All',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const byMint: Record<string, string[]> = {};
                            for (const p of filteredProofs) {
                                if (!byMint[p.mintUrl]) byMint[p.mintUrl] = [];
                                byMint[p.mintUrl].push(p.secret);
                            }
                            await Promise.all(
                                Object.entries(byMint).map(([mintUrl, secrets]) =>
                                    proofService.deleteProofs(mintUrl, secrets)
                                )
                            );
                            await refetchAll();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (err: any) {
                            Alert.alert('Erase Failed', err?.message ?? String(err));
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleExportAllUnspent = async () => {
        if (filteredProofs.length === 0) return;
        try {
            const byMint: Record<string, CoreProof[]> = {};
            for (const p of filteredProofs) {
                if (!byMint[p.mintUrl]) byMint[p.mintUrl] = [];
                byMint[p.mintUrl].push(p);
            }
            const tokens = Object.entries(byMint).map(([mintUrl, proofs]) =>
                proofService.encodeProofsAsToken(mintUrl, proofs, 'sat')
            );
            const combined = tokens.join('\n\n');
            await RNShare.share({ message: combined });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            toast.show('Nothing to share', { message: 'Share cancelled or unavailable' });
        }
    };

    // ── Tab chips ──────────────────────────────────────────────────────────────

    const renderTabChips = () => (
        <XStack gap="$2">
            {(Object.entries(TAB_META) as [ProofTab, typeof TAB_META.unspent][]).map(([tab, meta]) => {
                const isActive = activeTab === tab;
                const Icon = meta.icon;
                return (
                    <Button
                        key={tab}
                        size="$2.5"
                        flex={1}
                        bg={isActive ? (meta.bg as any) : '$gray3'}
                        borderWidth={isActive ? 1 : 0}
                        borderColor={isActive ? (meta.color as any) : 'transparent'}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setActiveTab(tab);
                        }}
                        pressStyle={{ scale: 0.97 }}
                        animation="quick"
                        icon={<Icon size={13} color={isActive ? meta.color as any : '$gray9'} />}
                    >
                        <Text fontSize="$2" fontWeight="800" color={isActive ? meta.color as any : '$gray9'}>
                            {meta.label}
                        </Text>
                        {counts[tab] > 0 && (
                            <Circle size={16} bg={isActive ? (meta.color as any) : '$gray7'} ml="$1">
                                <Text fontSize={9} fontWeight="900" color="white">
                                    {counts[tab] > 99 ? '99+' : counts[tab]}
                                </Text>
                            </Circle>
                        )}
                    </Button>
                );
            })}
        </XStack>
    );

    // ── Proof list section ─────────────────────────────────────────────────────

    const renderProofList = () => {
        if (filteredProofs.length === 0) {
            const meta = TAB_META[activeTab];
            const Icon = meta.icon;
            return (
                <YStack py="$12" items="center" justify="center" gap="$3" opacity={0.5}>
                    <View p="$4" bg="$gray3" rounded="$5">
                        <Icon size={32} color="$gray9" />
                    </View>
                    <YStack items="center" gap="$1">
                        <Text fontWeight="700" color="$color">No {meta.label.toLowerCase()} proofs</Text>
                        <Text fontSize="$3" color="$gray10" text="center" px="$4">
                            {activeTab === 'unspent'
                                ? 'Your spendable proofs will appear here.'
                                : activeTab === 'inflight'
                                    ? 'Proofs locked by pending send operations appear here.'
                                    : 'Spent proof records will accumulate here over time.'}
                        </Text>
                    </YStack>
                </YStack>
            );
        }
        return (
            <YStack rounded="$5" bg="$gray2" overflow="hidden">
                {filteredProofs.map((proof, i) => (
                    <ProofRow
                        key={`${proof.mintUrl}-${proof.secret}`}
                        proof={proof}
                        onPress={handleProofPress}
                        isLast={i === filteredProofs.length - 1}
                    />
                ))}
            </YStack>
        );
    };

    // ── Proof action sheet content ─────────────────────────────────────────────

    const renderSheetDetails = () => {
        if (!selectedProof) return null;
        const meta = TAB_META[selectedProof.state as ProofTab] ?? TAB_META.unspent;
        const isReady = selectedProof.state === 'ready';
        const isInflight = selectedProof.state === 'inflight';

        return (
            <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
            >
                <YStack p="$4" gap="$4">
                    {/* Header */}
                    <YStack gap="$2" items="center" pb="$2">
                        <View p="$4" bg={meta.bg as any} rounded="$10">
                            <PackageOpen size={30} color={meta.color as any} />
                        </View>
                        <Text fontSize="$8" fontWeight="900" letterSpacing={-1}>
                            ₿ {selectedProof.amount.toLocaleString()}
                        </Text>
                        <Text fontSize="$3" fontWeight="600" color="$gray10">satoshis</Text>
                        <XStack px="$3" py="$1" bg={meta.bg as any} rounded="$10">
                            <Text fontSize="$2" fontWeight="800" color={meta.color as any} textTransform="uppercase">
                                {selectedProof.state}
                            </Text>
                        </XStack>
                    </YStack>

                    <Separator borderColor="$borderColor" opacity={0.5} />

                    {/* ── Details table — nostr-profile.tsx style ── */}
                    <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden"
                        separator={<Separator borderColor="$borderColor" opacity={0.5} />}
                    >
                        <DetailItem
                            label="Amount"
                            value={`${selectedProof.amount.toLocaleString()} sats`}
                            isCopyable
                            copyValue={String(selectedProof.amount)}
                            onCopy={() => handleCopyField(String(selectedProof.amount), 'Amount')}
                        />
                        <DetailItem
                            label="Keyset ID"
                            value={truncateKeysetId(selectedProof.id)}
                            isCopyable
                            copyValue={selectedProof.id}
                            onCopy={() => handleCopyField(selectedProof.id, 'Keyset ID')}
                            onShare={() => handleShareField(selectedProof.id)}
                        />
                        <DetailItem
                            label="Secret"
                            value={truncateSecret(selectedProof.secret, 16)}
                            isCopyable
                            copyValue={selectedProof.secret}
                            onCopy={() => handleCopyField(selectedProof.secret, 'Secret')}
                            onShare={() => handleShareField(selectedProof.secret)}
                        />
                        <DetailItem
                            label="Mint"
                            value={getMintLabel(selectedProof.mintUrl)}
                            isCopyable
                            copyValue={selectedProof.mintUrl}
                            onCopy={() => handleCopyField(selectedProof.mintUrl, 'Mint URL')}
                            onShare={() => handleShareField(selectedProof.mintUrl)}
                        />
                        <DetailItem
                            label="State"
                            value={selectedProof.state}
                        />
                    </YStack>

                    {/* ── Inflight warning ── */}
                    {isInflight && (
                        <YStack p="$3" bg="$orange2" rounded="$4" gap="$1">
                            <XStack gap="$2" items="center">
                                <AlertCircle size={16} color="$orange10" />
                                <Text fontWeight="700" color="$orange10" fontSize="$3">In-flight Proof</Text>
                            </XStack>
                            <Text fontSize="$2" color="$orange10">
                                This proof is currently locked to a pending send operation. It cannot be exported or deleted until the operation completes or is rolled back.
                            </Text>
                        </YStack>
                    )}

                    {/* ── Primary action: Create Ecash Token ── */}
                    {isReady && (
                        <YStack gap="$2">
                            <Button
                                theme="accent"
                                size="$5"
                                height={54}
                                fontWeight="900"
                                fontSize="$4"
                                onPress={openSendStage}
                                disabled={isCreatingToken}
                                icon={<Zap size={20} />}
                                pressStyle={{ scale: 0.97 }}
                                animation="quick"
                            >
                                {isCreatingToken ? 'Creating Token…' : 'Create Ecash Token'}
                            </Button>
                            <Text fontSize="$2" color="$gray10" text="center">
                                Encodes this proof as an offline Cashu token. The proof is locked immediately.
                            </Text>
                        </YStack>
                    )}

                    {/* ── Destructive: delete ── */}
                    {(isReady || selectedProof.state === 'spent') && (
                        <Button
                            bg="$red2"
                            size="$4"
                            fontWeight="800"
                            onPress={handleDeleteProof}
                            disabled={isDeleting}
                            icon={<Trash2 size={16} color="$red10" />}
                        >
                            <Text fontWeight="800" color="$red10">
                                {isDeleting ? 'Deleting…' : 'Delete Proof from Device'}
                            </Text>
                        </Button>
                    )}

                    <Button
                        chromeless
                        size="$4"
                        onPress={() => proofActionSheetRef.current?.dismiss()}
                        fontWeight="700"
                        color="$gray10"
                    >
                        Close
                    </Button>
                </YStack>
            </BottomSheetScrollView>
        );
    };

    const renderSheetSend = () => {
        if (!selectedProof || !createdToken) return null;

        return (
            <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
            >
                <YStack px="$4" pt="$2" pb="$4" gap="$4">
                    {/* Back button */}
                    <Button
                        chromeless
                        size="$3"
                        alignSelf="flex-start"
                        icon={<ArrowLeft size={16} />}
                        onPress={() => setSheetStage('details')}
                        color="$gray10"
                        pressStyle={{ opacity: 0.7 }}
                    >
                        Back to Details
                    </Button>

                    {/* Header */}
                    <YStack items="center" gap="$1">
                        <Text fontSize="$6" fontWeight="900">Ecash Token Ready</Text>
                        <Text fontSize="$3" color="$gray10" text="center">
                            Scan the QR or copy the token string to send offline
                        </Text>
                    </YStack>

                    {/* QR + Copy / Share — full PendingTokenLayout */}
                    <PendingTokenLayout
                        token={createdToken}
                        amount={selectedProof.amount}
                        mintUrl={selectedProof.mintUrl}
                        hideActions={false}
                    />
                </YStack>
            </BottomSheetScrollView>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen
                options={{
                    headerTitle: 'Proof Manager',
                    headerLeft: () => (
                        <Button
                            circular chromeless
                            icon={<ChevronLeft size={24} />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
                        />
                    ),
                    headerRight: () => (
                        <Button
                            circular chromeless
                            icon={<RefreshCw size={20} />}
                            onPress={refetchAll}
                            disabled={isFetching}
                            opacity={isFetching ? 0.5 : 1}
                        />
                    ),
                }}
            />

            <ScrollView
                flex={1}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 } as any}
            >
                <YStack px="$4" pt="$4" gap="$4">

                    {/* ── Top filter row ── */}
                    <XStack justify="space-between" items="center">
                        <Button
                            size="$2.5"
                            theme="gray"
                            px="$2"
                            bg="$color5"
                            rounded="$3"
                            borderWidth={1}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                                mintFilterSheetRef.current?.present();
                            }}
                            pressStyle={{ scale: 0.97, opacity: 0.9 }}
                            icon={
                                <Avatar rounded="$3" size="$1.5">
                                    <Avatar.Image src={activeMintInfo?.icon} />
                                    <Avatar.Fallback bg="$color5" items="center" justify="center">
                                        <Building2 size={12} color="$color10" />
                                    </Avatar.Fallback>
                                </Avatar>
                            }
                            iconAfter={
                                <Square size="$1.5" bg="$color2" rounded="$3">
                                    <ChevronDown size={12} strokeWidth={2.5} color="$color" />
                                </Square>
                            }
                        >
                            <Text fontWeight="700" fontSize="$2" numberOfLines={1} style={{ maxWidth: 100 }}>
                                {mintFilter === 'all'
                                    ? 'All Mints'
                                    : activeMintInfo?.nickname || activeMintInfo?.name || getMintLabel(mintFilter)}
                            </Text>
                        </Button>

                        <XStack gap="$2" items="center">
                            <Text fontSize="$2" color="$gray10" fontWeight="600">Total</Text>
                            <Text fontSize="$5" fontWeight="900" color="$accent4">
                                ₿ {totalSats.toLocaleString()}
                            </Text>
                        </XStack>
                    </XStack>

                    {/* ── Summary stats ── */}
                    <XStack gap="$2">
                        <StatChip label="Unspent"   value={counts.unspent}  color="$green10" />
                        <StatChip label="In-flight" value={counts.inflight} color="$orange10" />
                        <StatChip label="Spent"     value={counts.spent}    color="$gray10" />
                    </XStack>

                    {/* ── Tab chips ── */}
                    {renderTabChips()}

                    {/* ── Bulk actions ── */}
                    {activeTab === 'unspent' && filteredProofs.length > 0 && (
                        <Button
                            size="$3"
                            bg="$green2"
                            borderWidth={1}
                            borderColor="$green5"
                            onPress={handleExportAllUnspent}
                            icon={<Share2 size={14} color="$green10" />}
                            pressStyle={{ scale: 0.97 }}
                        >
                            <Text fontSize="$2" fontWeight="800" color="$green10">
                                Export All ({filteredProofs.length})
                            </Text>
                        </Button>
                    )}

                    {activeTab === 'spent' && filteredProofs.length > 0 && (
                        <Button
                            size="$3"
                            bg="$red2"
                            borderWidth={1}
                            borderColor="$red4"
                            onPress={handleDeleteAllSpent}
                            disabled={isDeleting}
                            icon={<Trash2 size={14} color="$red10" />}
                            pressStyle={{ scale: 0.97 }}
                        >
                            <Text fontSize="$2" fontWeight="800" color="$red10">
                                {isDeleting ? 'Erasing…' : `Erase All Spent (${filteredProofs.length})`}
                            </Text>
                        </Button>
                    )}

                    {/* ── Section header ── */}
                    <XStack justify="space-between" items="center">
                        <Text fontSize="$5" fontWeight="800" color="$color4">
                            {TAB_META[activeTab].label} Proofs
                        </Text>
                        <View bg="$gray2" px="$2" py="$1" rounded="$3">
                            <Text fontSize="$3" color="$color" fontWeight="800">{filteredProofs.length}</Text>
                        </View>
                    </XStack>

                    {/* ── Proof list ── */}
                    {renderProofList()}

                    {/* ── Info box ── */}
                    <YStack mt="$2" p="$3" bg="$gray2" rounded="$4" borderWidth={1} borderColor="$borderColor" gap="$1.5">
                        <XStack gap="$2" items="center">
                            <Database size={14} color="$gray10" />
                            <Text fontSize="$2" fontWeight="700" color="$gray10">About Cashu Proofs</Text>
                        </XStack>
                        <Text fontSize="$2" color="$gray9" lineHeight="$3">
                            Proofs are cryptographic bearer tokens representing your ecash balance. Each has a denomination, a secret, and a blind signature from the mint. Unspent proofs = spendable funds.
                        </Text>
                    </YStack>

                </YStack>
            </ScrollView>

            {/* ── Mint filter bottom sheet ── */}
            <AppBottomSheet ref={mintFilterSheetRef} snapPoints={['50%', '80%']}>
                <YStack p="$4" gap="$3" pb={insets.bottom + 40}>
                    <Text fontSize="$6" fontWeight="700">Filter by Mint</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden"
                            separator={<Separator borderColor="$borderColor" opacity={0.3} />}
                        >
                            <XStack
                                items="center" justify="space-between"
                                py="$3" px="$4"
                                bg={mintFilter === 'all' ? '$gray3' : 'transparent'}
                                pressStyle={{ opacity: 0.7 }}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setMintFilter('all');
                                    mintFilterSheetRef.current?.dismiss();
                                }}
                            >
                                <XStack gap="$3" items="center">
                                    <View p="$2" bg="$gray4" rounded="$3">
                                        <Layers size={16} color="$color10" />
                                    </View>
                                    <Text fontWeight="700" fontSize="$4">All Mints</Text>
                                </XStack>
                                {mintFilter === 'all' && <Check size={18} color="$green10" />}
                            </XStack>

                            {allMints.map((mintUrl) => {
                                const info = mints.find(m => m.mintUrl === mintUrl);
                                const isSelected = mintFilter === mintUrl;
                                return (
                                    <XStack
                                        key={mintUrl}
                                        items="center" justify="space-between"
                                        py="$3" px="$4"
                                        bg={isSelected ? '$gray3' : 'transparent'}
                                        pressStyle={{ opacity: 0.7 }}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            setMintFilter(mintUrl);
                                            mintFilterSheetRef.current?.dismiss();
                                        }}
                                    >
                                        <XStack gap="$3" items="center" flex={1}>
                                            <Avatar rounded="$3" size="$3">
                                                <Avatar.Image src={info?.icon} />
                                                <Avatar.Fallback bg="$gray3" items="center" justify="center">
                                                    <Building2 size={16} color="$gray10" />
                                                </Avatar.Fallback>
                                            </Avatar>
                                            <YStack flex={1}>
                                                <Text fontWeight="700" fontSize="$4" numberOfLines={1}>
                                                    {info?.nickname || info?.name || 'Unknown Mint'}
                                                </Text>
                                                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                                                    {getMintLabel(mintUrl)}
                                                </Text>
                                            </YStack>
                                        </XStack>
                                        {isSelected && <Check size={18} color="$green10" />}
                                    </XStack>
                                );
                            })}
                        </YStack>
                    </ScrollView>
                </YStack>
            </AppBottomSheet>

            {/* ── Proof action bottom sheet — 90% snap ── */}
            <AppBottomSheet
                ref={proofActionSheetRef}
                snapPoints={['90%']}
            >
                {sheetStage === 'details' ? renderSheetDetails() : renderSheetSend()}
            </AppBottomSheet>
        </YStack>
    );
}
