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
import { YStack, XStack, H6, Text, View, ListItem, YGroup, Separator, Button } from 'tamagui';
import { ChevronRight, X, ArrowUpRight } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import { useNostrInboxStore, type NostrInboxItem } from '~/store/nostrInboxStore';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';

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

    const [selectedRequest, setSelectedRequest] = React.useState<NostrInboxItem | null>(null);
    const sheetRef = React.useRef<AppBottomSheetRef>(null);

    const handleOpenClaim = (item: NostrInboxItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (item.type === 'request') {
            setSelectedRequest(item);
            sheetRef.current?.present();
        } else {
            DeviceEventEmitter.emit('nostr:openClaim', item);
        }
    };

    const handlePayRequest = () => {
        if (!selectedRequest) return;
        sheetRef.current?.dismiss();
        router.push({
            pathname: '/(modals)/send',
            params: { paymentRequest: selectedRequest.tokenString, inboxItemId: selectedRequest.id }
        });
    };

    const handleDeclineRequest = () => {
        if (!selectedRequest) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        useNostrInboxStore.getState().dismiss(selectedRequest.id);
        sheetRef.current?.dismiss();
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

            <YGroup rounded="$5" bg="$gray3" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                {unclaimed.map((item) => (
                    <YGroup.Item key={item.id}>
                        <ListItem
                            hoverStyle={{ bg: '$backgroundHover' }}
                            pressStyle={{ bg: '$backgroundPress' }}
                            bg="transparent"
                            py="$3.5"
                            px="$4"
                            onPress={() => handleOpenClaim(item)}
                            icon={
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
                            }
                            iconAfter={
                                <Text
                                    fontWeight="800"
                                    fontSize="$5"
                                    color="$accent3"
                                >
                                    {item.type === 'request' ? '?' : '+'}₿{item.amount.toLocaleString()}
                                </Text>
                            }
                        >
                            <YStack flex={1} gap="$0.5" mr="$2">
                                <Text fontSize="$5" fontWeight="600" color="$accent5">
                                    {item.senderUsername || formatNpub(item.senderPubkey)}
                                </Text>
                                <Text fontSize="$3" color="$gray9">
                                    {timeAgo(item.receivedAt)}
                                </Text>
                            </YStack>
                        </ListItem>
                    </YGroup.Item>
                ))}
            </YGroup>

            <AppBottomSheet ref={sheetRef} snapPoints={['35%']}>
                <YStack p="$4" gap="$4" flex={1}>
                    <YStack items="center" gap="$2" mb="$2">
                        <Text fontSize="$5" fontWeight="800" color="$color">Payment Request</Text>
                        <Text fontSize="$3" color="$gray10" textAlign="center">
                            {selectedRequest?.senderUsername || (selectedRequest?.senderPubkey ? formatNpub(selectedRequest.senderPubkey) : 'Someone')} is requesting ₿{selectedRequest?.amount?.toLocaleString()} sats from you.
                        </Text>
                    </YStack>
                    <YStack gap="$3">
                        <Button
                            size="$5"
                            theme="accent"
                            fontWeight="800"
                            icon={<ArrowUpRight size={20} />}
                            onPress={handlePayRequest}
                        >
                            Pay Request
                        </Button>
                        <Button
                            size="$5"
                            bg="$red4"
                            color="$red10"
                            fontWeight="800"
                            icon={<X size={20} />}
                            onPress={handleDeclineRequest}
                        >
                            Decline
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}
