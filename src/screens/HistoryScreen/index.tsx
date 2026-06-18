import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { YStack, XStack, Text, Button, Separator, View, useTheme } from 'tamagui';
import { StyleSheet, TouchableOpacity, RefreshControl, View as RNView } from 'react-native';
import { Clock, ChevronDown, Building2, Check, Calendar, SlidersHorizontal } from '@tamagui/lucide-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { initService, historyService, eventService } from '../../services/core';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../../store/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';
import { HistoryItem } from './components/HistoryItem';
import { HistorySection } from './components/HistorySection';
import { HistoryPageSkeleton } from './components/HistorySkeletonItem';
import { ListItem, YGroup } from 'tamagui';
import { MintSelectorSheet } from '../../components/HomeMintSelector';
import { useNostrRequestStore } from '../../store/nostrRequestStore';
import { FlashList } from '@shopify/flash-list';

interface HistoryEntry {
    id: string;
    type: 'send' | 'receive' | 'mint' | 'melt' | 'swap';
    amount: number;
    unit: string;
    mintUrl: string;
    state?: string;
    createdAt: number;
    metadata?: any;
}

export function HistoryScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const cardBg = theme.gray3?.val ?? '#1f1f1f';
    const borderColor = theme.borderColor?.val ?? 'rgba(128,128,128,0.2)';

    const [mintFilter, setMintFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState('all');
    const { mints } = useWalletStore();

    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const timeSheetRef = useRef<AppBottomSheetRef>(null);

    const { pendingRequests, loadPendingRequests } = useNostrRequestStore();

    useEffect(() => {
        loadPendingRequests();
    }, []);

    const { data: history = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['history'],
        queryFn: async () => {
            if (!initService.isInitialized()) return [];
            return historyService.getHistory(200, 0) as Promise<HistoryEntry[]>;
        },
        enabled: initService.isInitialized(),
    });

    const filteredHistory = useMemo(() => {
        const pendingEntries: HistoryEntry[] = pendingRequests.map(req => ({
            id: req.id,
            type: 'receive-request' as any,
            amount: req.amount,
            unit: req.unit,
            mintUrl: req.mintUrl,
            state: req.state,
            createdAt: req.createdAt,
            metadata: { creqString: req.creqString, nostrPubkey: req.nostrPubkey },
        }));

        let filtered = [...pendingEntries, ...history];

        if (mintFilter !== 'all') {
            filtered = filtered.filter(e =>
                e.mintUrl.replace(/\/$/, '') === mintFilter.replace(/\/$/, ''),
            );
        }

        if (timeFilter !== 'all') {
            const now = Date.now();
            const startOfToday = new Date().setHours(0, 0, 0, 0);
            let cutoff = 0;
            switch (timeFilter) {
                case 'today': cutoff = startOfToday; break;
                case '3days': cutoff = now - 3 * 24 * 60 * 60 * 1000; break;
                case 'week': cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
                case 'month': cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
            }
            filtered = filtered.filter(e => e.createdAt >= cutoff);
        }

        const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
        const merged: HistoryEntry[] = [];
        const skipIds = new Set<string>();

        for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i];
            if (skipIds.has(current.id)) continue;

            let isSwap = false;
            if (current.type === 'receive' || current.type === 'mint') {
                for (let j = i + 1; j < Math.min(i + 4, sorted.length); j++) {
                    const older = sorted[j];
                    if (skipIds.has(older.id)) continue;
                    const isOut = older.type === 'send' || older.type === 'melt';
                    const timeDiff = Math.abs(current.createdAt - older.createdAt);
                    if (isOut && timeDiff < 60000) {
                        const amountDiff = Math.abs(current.amount - older.amount);
                        const isAmountMatch =
                            amountDiff === 0 ||
                            (older.type === 'melt' && amountDiff <= older.amount * 0.05);
                        if (isAmountMatch) {
                            merged.push({
                                ...current,
                                type: 'swap',
                                amount: older.amount,
                                metadata: { ...current.metadata, sourceId: older.id, targetId: current.id },
                            });
                            skipIds.add(older.id);
                            isSwap = true;
                            break;
                        }
                    }
                }
            }
            if (!isSwap) merged.push(current);
        }
        return merged;
    }, [history, pendingRequests, mintFilter, timeFilter]);

    const groupedHistory = useMemo(() => {
        const groups: { title: string; items: HistoryEntry[] }[] = [];
        let currentGroup: { title: string; items: HistoryEntry[] } | null = null;

        filteredHistory.forEach(entry => {
            const date = new Date(entry.createdAt);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            let groupTitle = '';
            if (date.toDateString() === today.toDateString()) {
                groupTitle = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                groupTitle = 'Yesterday';
            } else {
                groupTitle = date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                });
            }

            if (!currentGroup || currentGroup.title !== groupTitle) {
                currentGroup = { title: groupTitle, items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(entry);
        });

        return groups;
    }, [filteredHistory]);

    // Flatten into FlashList-compatible flat array
    // 'header' items render the date label; 'first' | 'middle' | 'last' | 'only' carry position info
    // so HistoryItem can render its own rounded-card corners.
    type FlatItem =
        | { kind: 'header'; title: string }
        | { kind: 'item'; entry: HistoryEntry; position: 'first' | 'middle' | 'last' | 'only' };

    const flatItems = useMemo((): FlatItem[] => {
        const items: FlatItem[] = [];
        for (const group of groupedHistory) {
            items.push({ kind: 'header', title: group.title });
            group.items.forEach((entry, idx) => {
                const total = group.items.length;
                const position =
                    total === 1 ? 'only'
                        : idx === 0 ? 'first'
                            : idx === total - 1 ? 'last'
                                : 'middle';
                items.push({ kind: 'item', entry, position });
            });
        }
        return items;
    }, [groupedHistory]);

    const handleTransactionPress = useCallback((id: string, type: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (type === 'receive-request') {
            router.push({ pathname: '/(modals)/receive', params: { requestId: id } });
        } else {
            router.push({ pathname: '/(modals)/txn-details', params: { id } });
        }
    }, [router]);

    const renderItem = useCallback(({ item }: { item: FlatItem }) => {
        if (item.kind === 'header') {
            return <HistorySection title={item.title}>{null}</HistorySection>;
        }
        const { entry, position } = item;

        const isFirst = position === 'first' || position === 'only';
        const isLast = position === 'last' || position === 'only';

        return (
            <RNView
                style={{
                    backgroundColor: cardBg,
                    borderTopLeftRadius: isFirst ? 16 : 0,
                    borderTopRightRadius: isFirst ? 16 : 0,
                    borderBottomLeftRadius: isLast ? 16 : 0,
                    borderBottomRightRadius: isLast ? 16 : 0,
                    overflow: 'hidden',
                }}
            >
                <HistoryItem
                    {...entry}
                    status={entry.state || 'completed'}
                    onPress={() => handleTransactionPress(entry.id, entry.type)}
                />
                {!isLast && (
                    <RNView
                        style={{
                            height: 1,
                            backgroundColor: borderColor,
                            opacity: 0.5,
                        }}
                    />
                )}
            </RNView>
        );
    }, [handleTransactionPress, cardBg, borderColor]);


    useEffect(() => {
        if (!initService.isInitialized()) return;
        const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['history'] });
        const unsubs = [
            eventService.on('history:updated', handleUpdate),
            eventService.on('receive:created', handleUpdate),
            eventService.on('send:created', handleUpdate),
            eventService.on('mint-quote:redeemed', handleUpdate),
        ];
        const sub = eventService.on('history:updated', loadPendingRequests);
        return () => { unsubs.forEach(u => u()); sub(); };
    }, [queryClient]);

    const handleTimeSelect = (val: string) => {
        setTimeFilter(val);
        timeSheetRef.current?.dismiss();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const getTimeFilterLabel = (val: string) => {
        switch (val) {
            case 'today': return 'Today';
            case '3days': return 'Last 3 Days';
            case 'week': return 'Last Week';
            case 'month': return 'Last Month';
            default: return 'All Time';
        }
    };

    const getMintFilterLabel = (val: string) => {
        if (val === 'all') return 'All Mints';
        const mint = mints.find(m => m.mintUrl === val);
        if (mint) return mint.nickname || mint.name || val.replace(/^https?:\/\//, '').substring(0, 15);
        return val.replace(/^https?:\/\//, '').substring(0, 15);
    };

    const isFiltered = mintFilter !== 'all' || timeFilter !== 'all';

    // Show skeleton during initial load
    if (isLoading && !isRefetching) {
        return (
            <YStack flex={1} bg="$background">
                {/* Filter bar skeleton */}
                <XStack px="$4" py="$3" gap="$2">
                    <View style={styles.filterSkeletonBtn} />
                    <View style={styles.filterSkeletonBtn} />
                </XStack>
                <HistoryPageSkeleton />
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            {/* ── Filter bar ── */}
            <XStack px="$4" pt="$3" pb="$2" gap="$2" items="center">
                <Button
                    flex={1}
                    size="$3"
                    bg={mintFilter !== 'all' ? '$accent3' : '$gray2'}
                    borderWidth={mintFilter !== 'all' ? 1 : 0}
                    borderColor={mintFilter !== 'all' ? '$accent8' : 'transparent'}
                    rounded="$4"
                    onPress={() => mintSheetRef.current?.present()}
                    icon={<Building2 size={13} color={mintFilter !== 'all' ? '$accent10' : '$gray10'} />}
                    iconAfter={<ChevronDown size={13} color="$gray10" />}
                >
                    <Text
                        fontSize="$3"
                        maxW={100}
                        ellipsizeMode="tail"
                        fontWeight="700"
                        numberOfLines={1}
                        color={mintFilter !== 'all' ? '$accent10' : '$color'}
                    >
                        {getMintFilterLabel(mintFilter)}
                    </Text>
                </Button>

                <Button
                    flex={1}
                    size="$3"
                    bg={timeFilter !== 'all' ? '$accent3' : '$gray2'}
                    borderWidth={timeFilter !== 'all' ? 1 : 0}
                    borderColor={timeFilter !== 'all' ? '$accent8' : 'transparent'}
                    rounded="$4"
                    onPress={() => timeSheetRef.current?.present()}
                    icon={<Calendar size={13} color={timeFilter !== 'all' ? '$accent10' : '$gray10'} />}
                    iconAfter={<ChevronDown size={13} color="$gray10" />}
                >
                    <Text
                        fontSize="$3"
                        fontWeight="700"
                        numberOfLines={1}
                        color={timeFilter !== 'all' ? '$accent10' : '$color'}
                    >
                        {getTimeFilterLabel(timeFilter)}
                    </Text>
                </Button>

                {isFiltered && (
                    <TouchableOpacity
                        onPress={() => { setMintFilter('all'); setTimeFilter('all'); }}
                        style={styles.clearBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text fontSize={11} fontWeight="700" color="$gray9">Clear</Text>
                    </TouchableOpacity>
                )}
            </XStack>

            {/* ── Content ── */}
            {flatItems.length === 0 ? (
                <YStack flex={1} items="center" justify="center" gap="$4" pb="$16">
                    <View style={styles.emptyIcon}>
                        <Clock size={36} color="$gray8" />
                    </View>
                    <YStack items="center" gap="$1">
                        <Text fontWeight="800" fontSize="$6" color="$color">
                            {isFiltered ? 'No results' : 'No activity yet'}
                        </Text>
                        <Text fontSize="$3" color="$gray9" text="center" px="$8" lineHeight={20}>
                            {isFiltered
                                ? 'Try clearing your filters to see all transactions.'
                                : 'Send or receive ecash to see your activity here.'}
                        </Text>
                    </YStack>
                    {isFiltered && (
                        <Button
                            size="$3"
                            bg="$gray3"
                            rounded="$4"
                            onPress={() => { setMintFilter('all'); setTimeFilter('all'); }}
                        >
                            <Text fontWeight="700">Clear Filters</Text>
                        </Button>
                    )}
                </YStack>
            ) : (
                <FlashList
                    data={flatItems}
                    keyExtractor={(item, i) =>
                        item.kind === 'header'
                            ? `header-${item.title}`
                            : `item-${item.entry.id}-${i}`
                    }
                    renderItem={renderItem}
                    estimatedItemSize={72}
                    getItemType={item => item.kind}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor="#FFD700"
                        />
                    }
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* ── Sheets ── */}
            <MintSelectorSheet
                ref={mintSheetRef}
                activeMintUrl={mintFilter}
                onSelect={url => { setMintFilter(url); mintSheetRef.current?.dismiss(); }}
                showAllOption={true}
            />

            <AppBottomSheet ref={timeSheetRef} snapPoints={['40%']}>
                <YStack p="$4" gap="$3">
                    <Text fontSize="$6" fontWeight="800">Filter by Time</Text>
                    <YGroup bordered separator={<Separator />}>
                        {[
                            { val: 'all', label: 'All Time' },
                            { val: 'today', label: 'Today' },
                            { val: '3days', label: 'Last 3 Days' },
                            { val: 'week', label: 'Last Week' },
                            { val: 'month', label: 'Last Month' },
                        ].map(item => (
                            <YGroup.Item key={item.val}>
                                <ListItem
                                    title={item.label}
                                    iconAfter={
                                        timeFilter === item.val
                                            ? <Check size={18} color="$green10" />
                                            : null
                                    }
                                    onPress={() => handleTimeSelect(item.val)}
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                    fontWeight={timeFilter === item.val ? '800' : '400'}
                                />
                            </YGroup.Item>
                        ))}
                    </YGroup>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}

const styles = StyleSheet.create({
    filterSkeletonBtn: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(128,128,128,0.12)',
    },
    clearBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(128,128,128,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
