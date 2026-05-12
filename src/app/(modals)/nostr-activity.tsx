/**
 * Nostr Activity Modal
 *
 * Full-screen modal with tabs (Pending · Received · Sent) showing all
 * Nostr payment activity. Pull-to-refresh checks pending proof states
 * and auto-marks spent items as claimed.
 *
 * Tapping a row opens a details bottom sheet with mint, amount, npub,
 * username, time, locked status, and a copy-token option.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, DeviceEventEmitter } from 'react-native';
import { YStack, XStack, Text, View, Separator, H6, Theme, Button, Spinner } from 'tamagui';
import { CheckCircle2, AlertCircle, ChevronRight, Inbox, ArrowUpRight, Building2, Clock, Lock, User, Copy, Zap } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { useNostrInboxStore, type NostrInboxItem } from '~/store/nostrInboxStore';
import { useContactsStore } from '~/store/contactsStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { historyService } from '~/services/core';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSettingsStore } from '~/store/settingsStore';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatNpub(hex: string): string {
    try {
        const npub = nip19.npubEncode(hex);
        return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
    } catch {
        return `${hex.slice(0, 6)}…`;
    }
}

function hexToNpub(hex: string): string {
    try {
        // Strip 02 prefix if present (SEC1 compressed key)
        const clean = hex.startsWith('02') && hex.length === 66 ? hex.slice(2) : hex;
        return nip19.npubEncode(clean);
    } catch {
        return hex;
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

function formatTime(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

type Tab = 'pending' | 'received' | 'sent';

// Unified detail item for the sheet
interface DetailItem {
    type: 'incoming' | 'sent';
    amount: number;
    mintUrl?: string;
    pubkey: string;       // hex or npub
    username?: string;
    timestamp: number;
    isP2PK?: boolean;
    tokenString?: string;
}

// ─── Username resolver ────────────────────────────────────────────────────

function useResolveUsername(pubkey: string): string | undefined {
    const favorites = useContactsStore(s => s.favorites);
    const contacts = useContactsStore(s => s.contacts || {});

    return useMemo(() => {
        // pubkey can be hex, npub, or 02-prefixed hex
        // Try all possible keys
        const candidates = [pubkey];
        // Try npub conversion
        try {
            const clean = pubkey.startsWith('02') && pubkey.length === 66 ? pubkey.slice(2) : pubkey;
            if (!clean.startsWith('npub')) {
                candidates.push(nip19.npubEncode(clean));
            }
        } catch {}

        for (const key of candidates) {
            if (favorites[key]?.username) return favorites[key].username!;
            if (contacts[key]?.username) return contacts[key].username!;
        }
        return undefined;
    }, [pubkey, favorites, contacts]);
}

// ─── Component ────────────────────────────────────────────────────────────

export default function NostrActivityModal() {
    const [activeTab, setActiveTab] = useState<Tab>('pending');
    const [refreshing, setRefreshing] = useState(false);
    const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const detailSheetRef = useRef<AppBottomSheetRef>(null);
    const [copied, setCopied] = useState(false);

    const items = useNostrInboxStore(s => s.items);
    const refreshPendingStates = useNostrInboxStore(s => s.refreshPendingStates);
    const queryClient = useQueryClient();

    const { secondaryCurrency } = useSettingsStore();
    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

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

    // Open details sheet
    const openDetail = useCallback((item: DetailItem) => {
        setDetailLoading(true);
        setDetailItem(item);
        setCopied(false);
        detailSheetRef.current?.present();
        // Simulate instant-open loader, then reveal content
        setTimeout(() => setDetailLoading(false), 300);
    }, []);

    const openInboxDetail = useCallback((item: NostrInboxItem) => {
        openDetail({
            type: 'incoming',
            amount: item.amount,
            mintUrl: item.mintUrl,
            pubkey: item.senderPubkey,
            username: item.senderUsername,
            timestamp: item.receivedAt,
            isP2PK: true,
            tokenString: item.tokenString,
        });
    }, [openDetail]);

    const openHistoryDetail = useCallback((entry: any) => {
        openDetail({
            type: 'sent',
            amount: entry.amount || 0,
            mintUrl: entry.mintUrl,
            pubkey: entry.metadata?.p2pkPubkey || '',
            timestamp: entry.createdAt || Date.now(),
            isP2PK: entry.metadata?.type === 'p2pk',
        });
    }, [openDetail]);

    const handleCopyToken = useCallback(async () => {
        if (!detailItem?.tokenString) return;
        await Clipboard.setStringAsync(detailItem.tokenString);
        setCopied(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setCopied(false), 2000);
    }, [detailItem]);

    const fiatValue = useMemo(() => {
        if (!btcData?.price || !detailItem?.amount) return null;
        const cur = SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency);
        const symbol = cur?.symbol ?? '$';
        const val = currencyService.convertSatsToCurrency(detailItem.amount, btcData.price);
        return `${symbol}${val.toFixed(2)}`;
    }, [btcData?.price, detailItem?.amount, secondaryCurrency]);

    const mintDomain = detailItem?.mintUrl
        ? detailItem.mintUrl.replace(/^https?:\/\//, '').split('/')[0]
        : 'Unknown';

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
                        <PendingTab items={unclaimed} onClaim={handleOpenClaim} onDetail={openInboxDetail} />
                    )}
                    {activeTab === 'received' && (
                        <ReceivedTab items={claimed} onDetail={openInboxDetail} />
                    )}
                    {activeTab === 'sent' && (
                        <SentTab entries={nostrHistory} onDetail={openHistoryDetail} />
                    )}
                </YStack>
            </ScrollView>

            {/* ── Details Sheet ────────────────────────────────────── */}
            <Theme inverse>
                <AppBottomSheet ref={detailSheetRef} onClose={() => { setDetailItem(null); setDetailLoading(false); }}>
                    <YStack p="$4" gap="$4" items="center">
                        {detailLoading ? (
                            <YStack py="$6" items="center" gap="$3">
                                <Spinner size="large" color="$color" />
                                <Text color="$gray10" fontSize="$3">Loading…</Text>
                            </YStack>
                        ) : detailItem ? (
                            <>
                                {/* Amount */}
                                <YStack items="center" gap="$1">
                                    <Text
                                        fontSize={32}
                                        fontWeight="900"
                                        color={detailItem.type === 'sent' ? '$red10' : '$color1'}
                                        letterSpacing={-1}
                                    >
                                        {detailItem.type === 'sent' ? '-' : '+'}₿{detailItem.amount.toLocaleString()}
                                    </Text>
                                    {fiatValue && (
                                        <Text fontSize="$3" color="$gray10">{fiatValue}</Text>
                                    )}
                                </YStack>

                                {/* Detail Rows */}
                                <Theme inverse>
                                    <YStack width="100%" rounded="$4" overflow="hidden" borderWidth={1} borderColor="$borderColor">
                                        <DetailSheetRow pubkey={detailItem.pubkey} storedUsername={detailItem.username} type={detailItem.type} />
                                        <Separator borderColor="$borderColor" opacity={0.3} />
                                        <DetailRow
                                            icon={<Building2 size={16} color="$gray9" />}
                                            label="Mint"
                                            value={mintDomain}
                                        />
                                        <Separator borderColor="$borderColor" opacity={0.3} />
                                        <DetailRow
                                            icon={<Clock size={16} color="$gray9" />}
                                            label="Time"
                                            value={formatTime(detailItem.timestamp)}
                                        />
                                        <Separator borderColor="$borderColor" opacity={0.3} />
                                        <DetailRow
                                            icon={<Lock size={16} color="$gray9" />}
                                            label="P2PK Lock"
                                            value={detailItem.isP2PK ? 'Yes' : 'No'}
                                        />
                                    </YStack>
                                </Theme>

                                {/* Actions */}
                                <XStack width="100%" gap="$3">
                                    {detailItem.tokenString && (
                                        <Button
                                            flex={1}
                                            themeInverse
                                            size="$5"
                                            fontWeight="700"
                                            rounded="$4"
                                            icon={<Copy size={16} />}
                                            onPress={handleCopyToken}
                                            pressStyle={{ scale: 0.97 }}
                                        >
                                            {copied ? 'Copied!' : 'Copy Token'}
                                        </Button>
                                    )}
                                    <Button
                                        flex={1}
                                        bg="$gray4"
                                        color="$color"
                                        size="$5"
                                        fontWeight="700"
                                        rounded="$4"
                                        onPress={() => detailSheetRef.current?.dismiss()}
                                        pressStyle={{ scale: 0.97 }}
                                    >
                                        Done
                                    </Button>
                                </XStack>
                            </>
                        ) : null}
                    </YStack>
                </AppBottomSheet>
            </Theme>
        </YStack>
    );
}

// ─── Detail Sheet Row with contact lookup ──────────────────────────────────

function DetailSheetRow({ pubkey, storedUsername, type }: { pubkey: string; storedUsername?: string; type: string }) {
    const resolved = useResolveUsername(pubkey);
    const display = storedUsername || resolved || formatNpub(pubkey);
    return (
        <DetailRow
            icon={<User size={16} color="$gray9" />}
            label={type === 'sent' ? 'To' : 'From'}
            value={display}
        />
    );
}

// ─── Pending Tab ──────────────────────────────────────────────────────────

function PendingTab({ items, onClaim, onDetail }: { items: NostrInboxItem[]; onClaim: (item: NostrInboxItem) => void; onDetail: (item: NostrInboxItem) => void }) {
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
                        onPress={() => onDetail(item)}
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
                                <PendingRowName pubkey={item.senderPubkey} storedUsername={item.senderUsername} />
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
                            onPress={(e: any) => { e.stopPropagation?.(); onClaim(item); }}
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

function PendingRowName({ pubkey, storedUsername }: { pubkey: string; storedUsername?: string }) {
    const resolved = useResolveUsername(pubkey);
    return (
        <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
            {storedUsername || resolved || formatNpub(pubkey)}
        </Text>
    );
}

// ─── Received Tab ─────────────────────────────────────────────────────────

function ReceivedTab({ items, onDetail }: { items: NostrInboxItem[]; onDetail: (item: NostrInboxItem) => void }) {
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
                        onPress={() => onDetail(item)}
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <XStack items="center" gap="$3" flex={1}>
                            <Blockies seed={item.senderPubkey} size={10} scale={4} style={{ borderRadius: 5 }} />
                            <YStack flex={1}>
                                <ReceivedRowName pubkey={item.senderPubkey} storedUsername={item.senderUsername} />
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

function ReceivedRowName({ pubkey, storedUsername }: { pubkey: string; storedUsername?: string }) {
    const resolved = useResolveUsername(pubkey);
    return (
        <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
            {storedUsername || resolved || formatNpub(pubkey)}
        </Text>
    );
}

// ─── Sent Tab ─────────────────────────────────────────────────────────────

function SentTab({ entries, onDetail }: { entries: any[]; onDetail: (entry: any) => void }) {
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
                        onPress={() => onDetail(entry)}
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <XStack items="center" gap="$3" flex={1}>
                            <Blockies
                                seed={entry.metadata?.p2pkPubkey || 'unknown'}
                                size={10}
                                scale={4}
                                style={{ borderRadius: 5 }}
                            />
                            <YStack flex={1}>
                                <SentRowName pubkey={entry.metadata?.p2pkPubkey || ''} />
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

function SentRowName({ pubkey }: { pubkey: string }) {
    const resolved = useResolveUsername(pubkey);
    return (
        <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
            {resolved || formatNpub(pubkey)}
        </Text>
    );
}

// ─── Shared Components ────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <XStack justify="space-between" items="center" px="$4" py="$3">
            <XStack gap="$2" items="center">
                {icon}
                <Text color="$gray10" fontSize="$3" fontWeight="500">{label}</Text>
            </XStack>
            <Text color="$color" fontSize="$3" fontWeight="700" numberOfLines={1} style={{ maxWidth: 180 }}>
                {value}
            </Text>
        </XStack>
    );
}

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
