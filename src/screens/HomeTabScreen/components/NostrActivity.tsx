/**
 * NostrActivity
 *
 * Home screen section showing recent Nostr payment activity.
 * Follows the same minimal design language as ManageBalances and SupportView:
 *   - H6 with dashed border header
 *   - Simple text rows with ChevronRight
 *   - No heavy cards or colored backgrounds
 */

import React, { useMemo } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { YStack, XStack, H6, Text, View, Image } from 'tamagui';
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Inbox, Zap } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import { useNostrInboxStore, type NostrInboxItem } from '~/store/nostrInboxStore';
import { useQuery } from '@tanstack/react-query';
import { historyService } from '~/services/core';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';

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
    return `${Math.floor(hours / 24)}d ago`;
}

export default function NostrActivity() {
    const items = useNostrInboxStore(s => s.items);
    const unseenCount = useNostrInboxStore(s => s.getUnseenCount());

    // Get recent nostr-related history entries
    const { data: nostrHistory = [] } = useQuery({
        queryKey: ['history', 'nostr'],
        queryFn: async () => {
            const entries = await historyService.getHistory(50, 0);
            return entries.filter((e: any) =>
                e.metadata?.nostr === true ||
                e.metadata?.type === 'p2pk' ||
                e.metadata?.p2pkPubkey
            ).slice(0, 5);
        },
        staleTime: 15_000,
        gcTime: 5 * 60_000,
    });

    const unclaimed = useMemo(() =>
        items.filter(i => i.status === 'pending' || i.status === 'failed').slice(0, 3),
        [items]
    );

    const recentClaimed = useMemo(() =>
        items.filter(i => i.status === 'claimed').slice(0, 3),
        [items]
    );

    const hasActivity = unclaimed.length > 0 || recentClaimed.length > 0 || nostrHistory.length > 0;

    const handleOpenClaim = (item: NostrInboxItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        DeviceEventEmitter.emit('nostr:openClaim', item);
    };

    return (
        <YStack width="100%" gap="$4" px="$1">
            {/* Section header — same style as ManageBalances / Support */}
            <XStack items="center" gap="$2">
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle="dashed">
                    Nostr Activity
                </H6>
                {unseenCount > 0 && (
                    <View bg="$accent9" px="$1.5" py="$0.5" rounded="$10" minWidth={20} items="center">
                        <Text color="white" fontSize={10} fontWeight="900">{unseenCount}</Text>
                    </View>
                )}
            </XStack>

            <YStack gap="$3">
                {/* Unclaimed incoming — simple row with dot indicator */}
                {unclaimed.map((item) => (
                    <XStack
                        key={item.id}
                        items="center"
                        justify="space-between"
                        onPress={() => handleOpenClaim(item)}
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <XStack items="center" gap="$2">
                            <View position="relative">
                                <Blockies seed={item.senderPubkey} size={8} scale={3} style={{ borderRadius: 3 }} />
                                {!item.seen && (
                                    <View
                                        position="absolute" top={-2} right={-2}
                                        bg="$red10" w={8} h={8} rounded="$10"
                                        borderWidth={1.5} borderColor="$background"
                                    />
                                )}
                            </View>
                            <YStack>
                                <H6>{item.senderUsername || formatNpub(item.senderPubkey)}</H6>
                                <Text fontSize="$1" color="$gray10">{timeAgo(item.receivedAt)} · Tap to claim</Text>
                            </YStack>
                        </XStack>
                        <XStack items="center" gap="$1">
                            <Text fontSize={16} fontWeight="900" color="$green10" letterSpacing={-0.5}>
                                +₿{item.amount.toLocaleString()}
                            </Text>
                            <ChevronRight size={16} strokeWidth={3} color="$green10" />
                        </XStack>
                    </XStack>
                ))}

                {/* Recent claimed */}
                {recentClaimed.map((item) => (
                    <XStack key={item.id} items="center" justify="space-between" pressStyle={{ opacity: 0.7 }}>
                        <XStack items="center" gap="$2">
                            <Blockies seed={item.senderPubkey} size={8} scale={3} style={{ borderRadius: 3 }} />
                            <YStack>
                                <H6>{item.senderUsername || formatNpub(item.senderPubkey)}</H6>
                                <Text fontSize="$1" color="$gray10">{timeAgo(item.receivedAt)} · Claimed</Text>
                            </YStack>
                        </XStack>
                        <Text fontSize={16} fontWeight="900" color="$accent4" letterSpacing={-0.5}>
                            +₿{item.amount.toLocaleString()}
                        </Text>
                    </XStack>
                ))}

                {/* History-based nostr sends */}
                {nostrHistory.slice(0, 3).map((entry: any, i: number) => (
                    <XStack key={`hist-${i}`} items="center" justify="space-between" pressStyle={{ opacity: 0.7 }}>
                        <XStack items="center" gap={10}>
                            <H6>
                                {entry.metadata?.p2pkPubkey
                                    ? formatNpub(entry.metadata.p2pkPubkey)
                                    : entry.type === 'send' ? 'Sent via Nostr' : 'Received'}
                            </H6>
                            <ChevronRight size={16} strokeWidth={3} color="$color" />
                        </XStack>
                        <Text
                            fontSize={16}
                            fontWeight="900"
                            letterSpacing={-0.5}
                            color={entry.type === 'send' ? "$accent4" : "$accent4"}
                        >
                            {entry.type === 'send' ? '-' : '+'}₿{entry.amount}
                        </Text>
                    </XStack>
                ))}

                {/* Empty state — minimal */}
                {!hasActivity && (
                    <XStack items="center" gap={10}>
                        <H6 color="$gray9">No activity yet</H6>
                        <ChevronRight size={16} strokeWidth={3} color="$gray9" />
                    </XStack>
                )}
            </YStack>
        </YStack>
    );
}
