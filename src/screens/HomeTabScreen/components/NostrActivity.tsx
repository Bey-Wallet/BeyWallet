/**
 * NostrActivity
 *
 * Home screen section showing only unclaimed incoming Nostr ecash.
 * Simple row: left blockie + name/npub, right rounded amount button.
 * Claimed items disappear from home — full history lives in the
 * nostr-activity modal.
 *
 * On mount, runs refreshPendingStates() to auto-mark any already-spent
 * tokens as claimed so they don't linger after restarts.
 */

import React, { useMemo, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { YStack, XStack, H6, Text, View } from 'tamagui';
import { ChevronRight } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import { useNostrInboxStore, type NostrInboxItem } from '~/store/nostrInboxStore';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

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
    const refreshPendingStates = useNostrInboxStore(s => s.refreshPendingStates);
    const router = useRouter();

    // On mount, check if any "pending" items are actually already spent
    useEffect(() => {
        const timer = setTimeout(() => {
            refreshPendingStates().catch(() => { });
        }, 2000); // Delay so it doesn't compete with init
        return () => clearTimeout(timer);
    }, []);

    // Only unclaimed (pending / failed) items
    const unclaimed = useMemo(() =>
        items.filter(i => i.status === 'pending' || i.status === 'failed'),
        [items]
    );

    const handleOpenClaim = (item: NostrInboxItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        DeviceEventEmitter.emit('nostr:openClaim', item);
    };

    // Nothing to show — hide entirely
    if (unclaimed.length === 0) return null;

    return (
        <YStack width="100%" gap="$4" px="$1">
            {/* Section header */}
            <XStack items="center" justify="space-between">
                <XStack items="center" gap="$2">
                    <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle="dashed">
                        Incoming
                    </H6>
                    <View bg="$red10" px="$1.5" py="$0.5" rounded="$10" minWidth={20} items="center">
                        <Text color="white" fontSize={10} fontWeight="900">{unclaimed.length}</Text>
                    </View>
                </XStack>
                <Text
                    fontSize="$2"
                    color="$gray10"
                    fontWeight="600"
                    onPress={() => router.push('/(modals)/nostr-activity')}
                    pressStyle={{ opacity: 0.6 }}
                >
                    View All
                </Text>
            </XStack>

            <YStack gap="$3">
                {unclaimed.map((item) => (
                    <XStack
                        key={item.id}
                        items="center"
                        justify="space-between"
                        pressStyle={{ opacity: 0.7 }}
                    >
                        {/* Left — blockie + info */}
                        <XStack items="center" gap="$3" flex={1}>
                            <View position="relative">
                                <Blockies seed={item.senderPubkey} size={10} scale={4} style={{ borderRadius: 5 }} />
                                {!item.seen && (
                                    <View
                                        position="absolute" top={-2} right={-2}
                                        bg="$red10" w={8} h={8} rounded="$10"
                                        borderWidth={1.5} borderColor="$background"
                                    />
                                )}
                            </View>
                            <YStack flex={1}>
                                <Text fontSize="$5" fontWeight="700" numberOfLines={1}>
                                    {item.senderUsername || formatNpub(item.senderPubkey)}
                                </Text>
                                <Text fontSize="$1" color="$gray10">{timeAgo(item.receivedAt)}</Text>
                            </YStack>
                        </XStack>

                        {/* Right — rounded amount button */}
                        <XStack
                            bg="$gray5"
                            px="$3"
                            py="$2"
                            rounded="$10"
                            items="center"
                            gap="$1"
                            onPress={() => handleOpenClaim(item)}
                            pressStyle={{ scale: 0.96, opacity: 0.85 }}
                            cursor="pointer"
                        >
                            <Text fontSize={15} fontWeight="900" color="$accent4" letterSpacing={-0.3}>
                                +₿{item.amount.toLocaleString()}
                            </Text>
                            <ChevronRight size={14} strokeWidth={3} color="$accent4" />
                        </XStack>
                    </XStack>
                ))}
            </YStack>
        </YStack>
    );
}
