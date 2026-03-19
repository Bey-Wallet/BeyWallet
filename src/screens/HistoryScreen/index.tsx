import React, { useEffect, useState, useMemo, useRef } from 'react';
import { YStack, XStack, Text, Button, ScrollView, Separator, View, Theme, ListItem, YGroup } from 'tamagui';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, Clock, Info, ShieldCheck, ArrowUp, ChevronDown, Check, Calendar, Building2, BanknoteArrowUp, BanknoteArrowDown, Landmark } from '@tamagui/lucide-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { initService, historyService, eventService } from '../../services/core';
import { Spinner } from '../../components/UI/Spinner';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { formatLocalTime } from '~/utils/time';
import { useWalletStore } from '../../store/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';

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

        // Mint filtering
        if (mintFilter !== 'all') {
            filtered = filtered.filter(entry =>
                entry.mintUrl.replace(/\/$/, '') === mintFilter.replace(/\/$/, '')
            );
        }

        // Time filtering
        if (timeFilter !== 'all') {
            const now = Date.now();
            let cutoff = 0;
            const startOfToday = new Date().setHours(0, 0, 0, 0);

            switch (timeFilter) {
                case 'today':
                    cutoff = startOfToday;
                    break;
                case '3days':
                    cutoff = now - (3 * 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    cutoff = now - (7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    cutoff = now - (30 * 24 * 60 * 60 * 1000);
                    break;
            }
            filtered = filtered.filter(entry => entry.createdAt >= cutoff);
        }

        const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
        const merged: any[] = [];
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

            if (!isSwap) {
                merged.push(current);
            }
        }

        return merged;
    }, [history, mintFilter, timeFilter]);

    // Real-time updates via coco events
    useEffect(() => {
        if (!initService.isInitialized()) return;

        const handleUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
        };

        const unsubs = [
            eventService.on('history:updated', handleUpdate),
            eventService.on('receive:created', handleUpdate),
            eventService.on('send:created', handleUpdate),
            eventService.on('mint-quote:redeemed', handleUpdate),
        ];

        return () => {
            unsubs.forEach(u => u());
        };
    }, [queryClient]);

    const getTransactionStyle = (type: string, status: string) => {
        const isOutgoing = type === 'send' || type === 'melt';
        const isPending = status.toLowerCase() === 'pending' || status.toLowerCase() === 'unpaid' || status.toLowerCase() === 'unclaimed';

        let iconColor = isOutgoing ? '$red10' : '$green11';
        let bgColor = isOutgoing ? '$red2' : '$green2';

        if (isPending) {
            iconColor = '$orange10';
            bgColor = '$orange2';
        }

        if (type === 'swap') {
            return {
                icon: RefreshCw,
                iconColor: '$blue10',
                bgColor: '$blue2',
                sign: '',
            };
        }

        return {
            icon: type === 'mint' ? Landmark : (isOutgoing ? BanknoteArrowUp : BanknoteArrowDown),
            iconColor,
            bgColor,
            sign: isOutgoing ? '-' : '+',
        };
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'send': return 'Sent';
            case 'receive': return 'Received';
            case 'mint': return 'Received (LN)';
            case 'melt': return 'Melted';
            case 'swap': return 'Swapped';
            default: return type;
        }
    };

    const handleTransactionPress = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/(modals)/txn-details',
            params: { id }
        });
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

            {/* Filters */}
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
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor="#FFD700"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                <YStack px="$4" pb="$10">
                    {filteredHistory.length === 0 ? (
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
                        <YStack gap="$4">
                            {filteredHistory.map((entry: HistoryEntry) => {
                                const status = entry.state || 'completed';
                                const style = getTransactionStyle(entry.type, status);

                                return (
                                    <YStack
                                        key={entry.id}
                                        onPress={() => handleTransactionPress(entry.id)}
                                        pressStyle={{ opacity: 0.7, scale: 0.98 }}
                                    >
                                        <XStack justify="space-between" items="center"  >
                                            <XStack gap="$3" items="center">
                                                <View
                                                    p="$2.5"
                                                    rounded="$4"
                                                    borderWidth={1}
                                                    borderColor="$borderColor"
                                                >
                                                    <style.icon size={24} strokeWidth={2} color={style.iconColor as any} />
                                                </View>
                                                <YStack>
                                                    <XStack gap="$2" items="center">
                                                        <Text fontWeight="700" fontSize="$4">
                                                            {getTypeLabel(entry.type)}
                                                        </Text>
                                                        {status.toLowerCase() !== 'completed' && (
                                                            <XStack px="$1.5" py="$0.5" bg="$gray5" rounded="$2">
                                                                <Text fontSize="$1" fontWeight="800" textTransform="uppercase" color="$gray10">
                                                                    {status}
                                                                </Text>
                                                            </XStack>
                                                        )}
                                                    </XStack>
                                                    <Text fontSize="$2" color="$gray10">
                                                        {formatLocalTime(entry.createdAt)}
                                                    </Text>
                                                </YStack>
                                            </XStack>

                                            <YStack items="flex-end" gap="$1">
                                                <Text
                                                    fontWeight="800"
                                                    fontSize="$7"
                                                    color={style.iconColor as any}
                                                >
                                                    {style.sign}{'₿'}{entry.amount}
                                                </Text>
                                            </YStack>
                                        </XStack>
                                    </YStack>
                                );
                            })}
                        </YStack>
                    )}
                </YStack>
            </ScrollView>

            {/* Mint Selection Sheet */}
            <AppBottomSheet ref={mintSheetRef}>
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
                        {mints.map((mint) => (
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

            {/* Time Selection Sheet */}
            <AppBottomSheet ref={timeSheetRef}>
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
