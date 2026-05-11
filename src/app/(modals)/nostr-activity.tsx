/**
 * Nostr Activity Modal
 *
 * Full-screen modal with tabs (Pending · Received · Sent) showing all
 * Nostr payment activity. Pull-to-refresh checks pending proof states
 * and auto-marks spent items as claimed.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, DeviceEventEmitter } from 'react-native';
import { YStack, XStack, Text, View, Separator, H6, Theme } from 'tamagui';
import { CheckCircle2, AlertCircle, ChevronRight, Inbox, ArrowUpRight } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import { useNostrInboxStore, type NostrInboxItem } from '~/store/nostrInboxStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { historyService } from '~/services/core';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatNpub(hex: string): string {
    try {
        const npub = nip19.npubEncode(hex);
        return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
    } catch {
        return `${hex.slice(0, 6)}…`;
    }
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

type Tab = 'pending' | 'received' | 'sent';

// ─── Component ────────────────────────────────────────────────────────────

export default function NostrActivityModal() {
    const [activeTab, setActiveTab] = useState<Tab>('pending');
    const [refreshing, setRefreshing] = useState(false);

    const items = useNostrInboxStore(s => s.items);
    const refreshPendingStates = useNostrInboxStore(s => s.refreshPendingStates);
    const queryClient = useQueryClient();

    // Nostr history from SDK
    const { data: nostrHistory = [], refetch: refetchHistory } = useQuery({
        queryKey: ['history', 'nostr'],
        queryFn: async () => {
            const entries = await historyService.getHistory(100, 0);
            return entries.filter((e: any) =>
                e.metadata?.nostr === true ||
                e.metadata?.type === 'p2pk' ||
                e.metadata?.p2pkPubkey
            );
        },
        staleTime: 15_000,
        gcTime: 5 * 60_000,
    });

    const unclaimed = useMemo(() =>
        items.filter(i => i.status === 'pending' || i.status === 'failed'),
        [items]
    );

    const claimed = useMemo(() =>
        items.filter(i => i.status === 'claimed'),
        [items]
    );

    const handleOpenClaim = (item: NostrInboxItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        DeviceEventEmitter.emit('nostr:openClaim', item);
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await refreshPendingStates();
            await refetchHistory();
        } catch {}
        setRefreshing(false);
    }, [refreshPendingStates, refetchHistory]);

    // ─── Tab data ─────────────────────────────────────────────────
    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'pending', label: 'Pending', count: unclaimed.length },
        { key: 'received', label: 'Received', count: claimed.length },
        { key: 'sent', label: 'Sent', count: nostrHistory.length },
    ];

    return (
        <YStack flex={1}>
            {/* ── Tab Bar ─────────────────────────────────────────── */}
            <XStack px="$4" pt="$2" pb="$3" gap="$2">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                        <XStack
                            key={tab.key}
                            flex={1}
                            bg={isActive ? '$color' : '$gray3'}
                            py="$2.5"
                            rounded="$4"
                            items="center"
                            justify="center"
                            gap="$1.5"
                            onPress={() => setActiveTab(tab.key)}
                            pressStyle={{ scale: 0.97, opacity: 0.9 }}
                            cursor="pointer"
                        >
                            <Text
                                fontSize="$3"
                                fontWeight="700"
                                color={isActive ? '$background' : '$gray10'}
                            >
                                {tab.label}
                            </Text>
                            {tab.count > 0 && (
                                <View
                                    bg={isActive ? '$background' : '$gray6'}
                                    px="$1.5"
                                    rounded="$10"
                                    minWidth={20}
                                    items="center"
                                >
                                    <Text
                                        fontSize={10}
                                        fontWeight="900"
                                        color={isActive ? '$color' : '$gray10'}
                                    >
                                        {tab.count}
                                    </Text>
                                </View>
                            )}
                        </XStack>
                    );
                })}
            </XStack>

            {/* ── Content ─────────────────────────────────────────── */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 80 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                    />
                }
            >
                <YStack px="$4" gap="$1">
                    {activeTab === 'pending' && (
                        <PendingTab items={unclaimed} onClaim={handleOpenClaim} />
                    )}
                    {activeTab === 'received' && (
                        <ReceivedTab items={claimed} />
                    )}
                    {activeTab === 'sent' && (
                        <SentTab entries={nostrHistory} />
                    )}
                </YStack>
            </ScrollView>
        </YStack>
    );
}

// ─── Pending Tab ──────────────────────────────────────────────────────────

function PendingTab({ items, onClaim }: { items: NostrInboxItem[]; onClaim: (item: NostrInboxItem) => void }) {
    if (items.length === 0) {
        return (
            <EmptyState
                icon={<CheckCircle2 size={48} color="$green9" />}
                title="All caught up"
                subtitle="No pending payments to claim."
            />
        );
    }

    return (
        <YStack gap="$0" rounded="$4" overflow="hidden" borderWidth={1} borderColor="$borderColor">
            {items.map((item, idx) => (
                <React.Fragment key={item.id}>
                    {idx > 0 && <Separator borderColor="$borderColor" opacity={0.4} />}
                    <XStack
                        items="center"
                        justify="space-between"
                        px="$3"
                        py="$3"
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <XStack items="center" gap="$3" flex={1}>
                            <View position="relative">
                                <Blockies seed={item.senderPubkey} size={10} scale={4} style={{ borderRadius: 5 }} />
                                {item.status === 'failed' && (
                                    <View
                                        position="absolute" bottom={-2} right={-2}
                                        bg="$red10" w={12} h={12} rounded="$10"
                                        items="center" justify="center"
                                    >
                                        <AlertCircle size={8} color="white" />
                                    </View>
                                )}
                            </View>
                            <YStack flex={1}>
                                <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
                                    {item.senderUsername || formatNpub(item.senderPubkey)}
                                </Text>
                                <Text fontSize="$1" color="$gray10">
                                    {timeAgo(item.receivedAt)}
                                    {item.status === 'failed' ? ' · Failed — tap to retry' : ''}
                                </Text>
                            </YStack>
                        </XStack>

                        <XStack
                            bg="$accent3"
                            px="$3"
                            py="$2"
                            rounded="$10"
                            items="center"
                            gap="$1"
                            onPress={() => onClaim(item)}
                            pressStyle={{ scale: 0.96, opacity: 0.85 }}
                            cursor="pointer"
                        >
                            <Text fontSize={15} fontWeight="900" color="$accent11" letterSpacing={-0.3}>
                                +₿{item.amount.toLocaleString()}
                            </Text>
                            <ChevronRight size={14} strokeWidth={3} color="$accent11" />
                        </XStack>
                    </XStack>
                </React.Fragment>
            ))}
        </YStack>
    );
}

// ─── Received Tab ─────────────────────────────────────────────────────────

function ReceivedTab({ items }: { items: NostrInboxItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                icon={<Inbox size={48} color="$gray8" />}
                title="No received payments"
                subtitle="Claimed Nostr payments will appear here."
            />
        );
    }

    return (
        <YStack gap="$0" rounded="$4" overflow="hidden" borderWidth={1} borderColor="$borderColor">
            {items.map((item, idx) => (
                <React.Fragment key={item.id}>
                    {idx > 0 && <Separator borderColor="$borderColor" opacity={0.4} />}
                    <XStack
                        items="center"
                        justify="space-between"
                        px="$3"
                        py="$3"
                    >
                        <XStack items="center" gap="$3" flex={1}>
                            <Blockies seed={item.senderPubkey} size={10} scale={4} style={{ borderRadius: 5 }} />
                            <YStack flex={1}>
                                <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
                                    {item.senderUsername || formatNpub(item.senderPubkey)}
                                </Text>
                                <Text fontSize="$1" color="$gray10">
                                    {timeAgo(item.receivedAt)} · Claimed
                                </Text>
                            </YStack>
                        </XStack>

                        <XStack items="center" gap="$1">
                            <Text fontSize={15} fontWeight="800" color="$green10" letterSpacing={-0.3}>
                                +₿{item.amount.toLocaleString()}
                            </Text>
                            <CheckCircle2 size={14} color="$green10" />
                        </XStack>
                    </XStack>
                </React.Fragment>
            ))}
        </YStack>
    );
}

// ─── Sent Tab ─────────────────────────────────────────────────────────────

function SentTab({ entries }: { entries: any[] }) {
    if (entries.length === 0) {
        return (
            <EmptyState
                icon={<ArrowUpRight size={48} color="$gray8" />}
                title="No sent payments"
                subtitle="Nostr sends will appear here."
            />
        );
    }

    return (
        <YStack gap="$0" rounded="$4" overflow="hidden" borderWidth={1} borderColor="$borderColor">
            {entries.map((entry: any, idx: number) => (
                <React.Fragment key={`hist-${idx}`}>
                    {idx > 0 && <Separator borderColor="$borderColor" opacity={0.4} />}
                    <XStack
                        items="center"
                        justify="space-between"
                        px="$3"
                        py="$3"
                    >
                        <XStack items="center" gap="$3" flex={1}>
                            <Blockies
                                seed={entry.metadata?.p2pkPubkey || 'unknown'}
                                size={10}
                                scale={4}
                                style={{ borderRadius: 5 }}
                            />
                            <YStack flex={1}>
                                <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
                                    {entry.metadata?.p2pkPubkey
                                        ? formatNpub(entry.metadata.p2pkPubkey)
                                        : 'Unknown'}
                                </Text>
                                <Text fontSize="$1" color="$gray10">
                                    {entry.createdAt ? timeAgo(entry.createdAt) : 'Unknown time'}
                                </Text>
                            </YStack>
                        </XStack>

                        <Text fontSize={15} fontWeight="800" color="$red10" letterSpacing={-0.3}>
                            -₿{entry.amount?.toLocaleString() ?? 0}
                        </Text>
                    </XStack>
                </React.Fragment>
            ))}
        </YStack>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <YStack items="center" justify="center" py="$10" gap="$3">
            {icon}
            <Text color="$gray9" fontSize="$5" fontWeight="600">
                {title}
            </Text>
            <Text color="$gray8" fontSize="$3" textAlign="center" maxWidth={260}>
                {subtitle}
            </Text>
        </YStack>
    );
}
