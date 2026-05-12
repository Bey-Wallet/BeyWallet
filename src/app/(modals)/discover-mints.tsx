import React, { useState, useEffect, useCallback } from 'react';
import { YStack, XStack, Text, Button, View, ScrollView, Spinner } from 'tamagui';
import { ShieldCheck, ShieldOff, Star, MessageSquare, ArrowLeft, RefreshCw, AlertTriangle } from '@tamagui/lucide-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import AddMintModal, { AddMintModalRef } from '../../components/AddMintModal';
import { useRef } from 'react';

import { mintRecommendationService, type MintRecommendation } from '../../services/mintRecommendationService';
import { useWalletStore } from '../../store/walletStore';
import { MintIcon } from '../../screens/ExpolreTabScreen/components/MintIcon';
import { fetchMintMeta, type MintMetadata } from '../../screens/ExpolreTabScreen/components/mintMeta';

const PAGE_SIZE = 10;

export default function DiscoverMintsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { mints: walletMints, trustMint } = useWalletStore();
    const addMintRef = useRef<AddMintModalRef>(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // ─── Fetch All Mints ───────────────────────────────────────────────────
    const {
        data: allMints = [],
        isLoading,
        isError,
        refetch,
        isRefetching
    } = useQuery<MintRecommendation[]>({
        queryKey: ['all-mint-recommendations'],
        queryFn: async () => {
            // Fetch a larger limit to simulate "all" mints
            return await mintRecommendationService.discoverMints(100);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const displayedMints = allMints.slice(0, visibleCount);
    const hasMore = visibleCount < allMints.length;

    const loadMore = useCallback(() => {
        if (hasMore && !isLoading && !isRefetching) {
            setVisibleCount(prev => prev + PAGE_SIZE);
        }
    }, [hasMore, isLoading, isRefetching]);

    const normalizeUrl = (url: string) => url.replace(/\/$/, '');

    const getMintStatus = (url: string) => {
        const walletMint = walletMints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(url));
        if (!walletMint) return 'none';
        return walletMint.trusted ? 'trusted' : 'untrusted';
    };

    const handleAction = async (url: string, status: string) => {
        if (status === 'none') {
            addMintRef.current?.present(url);
        } else if (status === 'untrusted') {
            try { await trustMint(url); } catch (e) { console.error(e); }
        }
    };

    const renderItem = ({ item }: { item: MintRecommendation }) => {
        const status = getMintStatus(item.url);
        const actionLabel = status === 'trusted' ? 'Added' : status === 'untrusted' ? 'Trust' : 'Add';
        const actionTheme = status === 'trusted' ? 'green' : status === 'untrusted' ? 'orange' : 'accent';

        return <MintCard mint={item} status={status} actionLabel={actionLabel} actionTheme={actionTheme} onAction={handleAction} />;
    };

    return (
        <YStack flex={1} bg="$background">



            {/* Content */}
            {isLoading ? (
                <YStack flex={1} items="center" justify="center">
                    <Spinner size="large" />
                    <Text mt="$2" color="$gray10">Loading mints...</Text>
                </YStack>
            ) : isError ? (
                <YStack flex={1} items="center" justify="center" px="$4" gap="$3">
                    <AlertTriangle size={48} color="$red10" />
                    <Text fontSize="$5" fontWeight="600">Failed to load mints</Text>
                    <Text color="$gray10" textAlign="center">Check your connection or try again later.</Text>
                    <Button theme="accent" onPress={() => refetch()}>Retry</Button>
                </YStack>
            ) : allMints.length === 0 ? (
                <YStack flex={1} items="center" justify="center" px="$4">
                    <Text color="$gray10">No mints found.</Text>
                </YStack>
            ) : (
                <FlatList
                    data={displayedMints}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.url}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={{ padding: 16, gap: 16 }}
                    ListFooterComponent={
                        hasMore ? (
                            <YStack py="$4" items="center">
                                <Spinner size="small" />
                            </YStack>
                        ) : (
                            <YStack py="$4" items="center">
                                <Text color="$gray9" fontSize="$2">No more mints</Text>
                            </YStack>
                        )
                    }
                />
            )}
            <AddMintModal ref={addMintRef} />
        </YStack>
    );
}

interface MintCardProps {
    mint: MintRecommendation;
    status: string;
    actionLabel: string;
    actionTheme: string;
    onAction: (url: string, status: string) => void;
}

function MintCard({ mint, status, actionLabel, actionTheme, onAction }: MintCardProps) {
    const { data: meta } = useQuery<MintMetadata>({
        queryKey: ['mint-meta', mint.url],
        queryFn: () => fetchMintMeta(mint.url),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const displayName = meta?.name || mint.name || (() => {
        try { return new URL(mint.url).hostname; } catch { return mint.url; }
    })();

    const hostname = (() => {
        try { return new URL(mint.url).hostname; } catch { return mint.url; }
    })();

    return (
        <YStack
            width="100%"
            minH={160}
            bg="$gray2"
            rounded="$5"
            overflow="hidden"
            p="$3"
            gap="$2"
            pressStyle={{ opacity: 0.9 }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(modals)/mint-profile', params: { url: mint.url } });
            }}
        >
            {/* Top Row: Icon and Button */}
            <XStack items="center" justify="space-between" gap="$2">
                <View bg="$background" p="$1" rounded="$10">
                    <MintIcon url={mint.url} hintIcon={mint.icon} size={50} />
                </View>

                <Button
                    size="$3"
                    theme={actionTheme as any}
                    disabled={status === 'trusted'}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onAction(mint.url, status);
                    }}
                    px="$3"
                    rounded="$10"
                    fontWeight="700"
                    fontSize="$3"
                >
                    {actionLabel}
                </Button>
            </XStack>

            {/* Content */}
            <YStack justify="flex-start" width="100%" items="flex-start" mt="$1" gap="$1">
                <Text fontSize="$5" fontWeight="600" numberOfLines={1}>
                    {displayName}
                </Text>
                <Text fontSize="$3" color="$gray12" numberOfLines={1}>
                    {hostname}
                </Text>

                <XStack items="center" gap="$1" mt="$0.5">
                    {status === 'trusted' && <ShieldCheck size={12} color="$green10" />}
                    {status === 'untrusted' && <ShieldOff size={12} color="$orange10" />}
                    <Text fontSize="$2" color="$gray10">
                        {status === 'trusted' ? 'Trusted' : status === 'untrusted' ? 'Untrusted' : 'Not added'}
                    </Text>
                </XStack>
            </YStack>

            {/* Bottom: Rating and Reviews */}
            <YStack mt="auto" gap="$1" pt="$2" borderTopWidth={1} borderTopColor="$borderColor" borderStyle="solid" opacity={0.5}>
                <XStack justify="space-between" items="center">
                    <XStack items="center" gap="$1">
                        <Star size={12} color="#FFD700" fill="#FFD700" />
                        <Text fontSize="$2" fontWeight="600" color="$color">
                            {mint.averageRating ? mint.averageRating.toFixed(1) : '0.0'}
                        </Text>
                    </XStack>
                    <XStack items="center" gap="$1">
                        <MessageSquare size={12} color="$gray10" />
                        <Text fontSize="$2" color="$gray10">
                            {mint.reviewsCount || 0} reviews
                        </Text>
                    </XStack>
                </XStack>
            </YStack>
        </YStack>
    );
}
