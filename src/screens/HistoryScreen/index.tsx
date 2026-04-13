import React, { useEffect, useState, useMemo, useRef } from 'react';
import { YStack, XStack, Text, Button, ScrollView, Separator, View } from 'tamagui';
import { Clock, ChevronDown, Calendar, Building2, Check } from '@tamagui/lucide-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { initService, historyService, eventService } from '../../services/core';
import { Spinner } from '../../components/UI/Spinner';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../../store/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';
import { HistoryItem } from './components/HistoryItem';
import { HistorySection } from './components/HistorySection';
import { ListItem, YGroup } from 'tamagui';

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

    const [mintFilter, setMintFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState('all');
    const { mints } = useWalletStore();

    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const timeSheetRef = useRef<AppBottomSheetRef>(null);

    const { data: history = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['history'],
        queryFn: async () => {
            if (!initService.isInitialized()) {
                return [];
            }
            return historyService.getHistory(200, 0) as Promise<HistoryEntry[]>;
        },
        enabled: initService.isInitialized(),
    });

    const filteredHistory = useMemo(() => {
        let filtered = history;

        if (mintFilter !== 'all') {
            filtered = filtered.filter(entry =>
                entry.mintUrl.replace(/\/$/, '') === mintFilter.replace(/\/$/, '')
            );
        }

        if (timeFilter !== 'all') {
            const now = Date.now();
            let cutoff = 0;
            const startOfToday = new Date().setHours(0, 0, 0, 0);

            switch (timeFilter) {
                case 'today': cutoff = startOfToday; break;
                case '3days': cutoff = now - (3 * 24 * 60 * 60 * 1000); break;
                case 'week': cutoff = now - (7 * 24 * 60 * 60 * 1000); break;
                case 'month': cutoff = now - (30 * 24 * 60 * 60 * 1000); break;
            }
            filtered = filtered.filter(entry => entry.createdAt >= cutoff);
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
                        const isAmountMatch = amountDiff === 0 || (older.type === 'melt' && amountDiff <= older.amount * 0.05);
                        if (isAmountMatch) {
                            merged.push({
                                ...current,
                                type: 'swap',
                                amount: older.amount,
                                metadata: { ...current.metadata, sourceId: older.id, targetId: current.id }
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
    }, [history, mintFilter, timeFilter]);

    const groupedHistory = useMemo(() => {
        const groups: { title: string, items: HistoryEntry[] }[] = [];
        let currentGroup: { title: string, items: HistoryEntry[] } | null = null;

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
                groupTitle = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }

            if (!currentGroup || currentGroup.title !== groupTitle) {
                currentGroup = { title: groupTitle, items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(entry);
        });

        return groups;
    }, [filteredHistory]);

    useEffect(() => {
        if (!initService.isInitialized()) return;
        const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['history'] });
        const unsubs = [
            eventService.on('history:updated', handleUpdate),
            eventService.on('receive:created', handleUpdate),
            eventService.on('send:created', handleUpdate),
            eventService.on('mint-quote:redeemed', handleUpdate),
        ];
        return () => unsubs.forEach(u => u());
    }, [queryClient]);

    const handleTransactionPress = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/(modals)/txn-details', params: { id } });
    };

    const handleMintSelect = (url: string) => {
        setMintFilter(url);
        mintSheetRef.current?.dismiss();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

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

    if (isLoading && !isRefetching) {
        return (
            <YStack flex={1} items="center" justify="center" bg="$background">
                <Spinner size="large" />
                <Text mt="$2" color="$gray10">Loading history...</Text>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg="$background">
            <XStack px="$4" py="$3" gap="$2">
                <Button
                    flex={1}
                    size="$3"
                    bg="$gray2"
                    borderWidth={0}
                    rounded="$4"
                    onPress={() => mintSheetRef.current?.present()}
                    icon={<Building2 size={14} color="$gray10" />}
                    iconAfter={<ChevronDown size={14} color="$gray10" />}
                >
                    <Text fontSize="$3" maxW={100} ellipsizeMode="tail" fontWeight="600" numberOfLines={1}>
                        {getMintFilterLabel(mintFilter)}
                    </Text>
                </Button>

                <Button
                    flex={1}
                    size="$3"
                    bg="$gray2"
                    borderWidth={0}
                    rounded="$4"
                    onPress={() => timeSheetRef.current?.present()}
                    icon={<Calendar size={14} color="$gray10" />}
                    iconAfter={<ChevronDown size={14} color="$gray10" />}
                >
                    <Text fontSize="$3" fontWeight="600" numberOfLines={1}>
                        {getTimeFilterLabel(timeFilter)}
                    </Text>
                </Button>
            </XStack>

            <ScrollView
                flex={1}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FFD700" />}
                showsVerticalScrollIndicator={false}
            >
                <YStack px="$4" pb="$10">
                    {groupedHistory.length === 0 ? (
                        <YStack py="$10" items="center" justify="center" gap="$3">
                            <View p="$4" bg="$gray2" rounded="$10">
                                <Clock size={32} color="$gray9" />
                            </View>
                            <YStack items="center">
                                <Text fontWeight="700">No transactions yet</Text>
                                <Text fontSize="$3" color="$gray9" text="center" mt="$1">
                                    When you send or receive tokens, they will appear here.
                                </Text>
                            </YStack>
                        </YStack>
                    ) : (
                        groupedHistory.map((group) => (
                            <HistorySection key={group.title} title={group.title}>
                                {group.items.map((entry) => (
                                    <HistoryItem
                                        key={entry.id}
                                        {...entry}
                                        status={entry.state || 'completed'}
                                        onPress={() => handleTransactionPress(entry.id)}
                                    />
                                ))}
                            </HistorySection>
                        ))
                    )}
                </YStack>
            </ScrollView>

            <AppBottomSheet ref={mintSheetRef} snapPoints={['50%', '80%']}>
                <YStack p="$4" gap="$4">
                    <Text fontSize="$6" fontWeight="700">Filter by Mint</Text>
                    <YGroup bordered separator={<Separator />}>
                        <YGroup.Item>
                            <ListItem
                                title="All Mints"
                                iconAfter={mintFilter === 'all' ? <Check size={18} color="$green10" /> : null}
                                onPress={() => handleMintSelect('all')}
                                hoverStyle={{ bg: '$backgroundHover' }}
                                pressStyle={{ bg: '$backgroundPress' }}
                            />
                        </YGroup.Item>
                        {(mints || []).map((mint) => (
                            <YGroup.Item key={mint.mintUrl}>
                                <ListItem
                                    title={mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '')}
                                    subTitle={mint.mintUrl}
                                    iconAfter={mintFilter === mint.mintUrl ? <Check size={18} color="$green10" /> : null}
                                    onPress={() => handleMintSelect(mint.mintUrl)}
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                />
                            </YGroup.Item>
                        ))}
                    </YGroup>
                </YStack>
            </AppBottomSheet>

            <AppBottomSheet ref={timeSheetRef} snapPoints={['40%']}>
                <YStack p="$4" gap="$4">
                    <Text fontSize="$6" fontWeight="700">Filter by Time</Text>
                    <YGroup bordered separator={<Separator />}>
                        {[
                            { val: 'all', label: 'All Time' },
                            { val: 'today', label: 'Today' },
                            { val: '3days', label: 'Last 3 Days' },
                            { val: 'week', label: 'Last Week' },
                            { val: 'month', label: 'Last Month' },
                        ].map((item) => (
                            <YGroup.Item key={item.val}>
                                <ListItem
                                    title={item.label}
                                    iconAfter={timeFilter === item.val ? <Check size={18} color="$green10" /> : null}
                                    onPress={() => handleTimeSelect(item.val)}
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                />
                            </YGroup.Item>
                        ))}
                    </YGroup>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}
