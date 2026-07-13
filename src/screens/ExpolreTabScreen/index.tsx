import React, { useState, useCallback, useMemo, useRef } from 'react';
import { YStack, ScrollView, XStack, Text, Button, Input, H6, ZStack } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Search, Plus, Star, Sparkles } from '@tamagui/lucide-icons';

import { mintRecommendationService, type MintRecommendation } from '../../services/mintRecommendationService';
import { useWalletStore } from '../../store/walletStore';
import { initService } from '../../services/core';
import AddMintModal, { AddMintModalRef } from '../../components/AddMintModal';

import { MintList } from './components/MintList';
import { MintEmptyState } from './components/MintEmptyState';
import { type MintStatus } from './components/MintListItem';
import ContactsView from '~/screens/HomeTabScreen/components/ContactsView';
import { SafeAreaView } from 'react-native-safe-area-context';
import Blockies from '~/components/UI/Blockies';


const normalizeUrl = (url: string) => url.replace(/\/$/, '');

export default function ExploreTabScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const addMintRef = useRef<AddMintModalRef>(null);
    const { mints, trustMint } = useWalletStore();

    // ─── Nostr mint discovery (Cached only on mount) ──────────────────────────
    const {
        data: nostrMints = [],
        isLoading,
        isRefetching,
    } = useQuery<MintRecommendation[]>({
        queryKey: ['mint-recommendations'],
        queryFn: async () => {
            const repo = initService.getRepo();
            const cached = await repo.mintRecommendationRepository.getAll();
            // Only return cached data to avoid network wait on mount
            return cached;
        },
        staleTime: Infinity,
    });

    // ─── Pull-to-refresh (Handles network fetch) ──────────────────────────────
    const handleRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const discovered = await mintRecommendationService.discoverMints(50);
            if (discovered.length > 0) {
                const repo = initService.getRepo();
                await repo.mintRecommendationRepository.deleteAll();
                await repo.mintRecommendationRepository.saveAll(discovered);
                queryClient.setQueryData(['mint-recommendations'], discovered);
            }
        } catch (e) {
            console.error('[ExploreTabScreen] Refresh failed:', e);
        }
    }, [queryClient]);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getMintStatus = (url: string): MintStatus => {
        const walletMint = mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(url));
        if (!walletMint) return 'none';
        return walletMint.trusted ? 'trusted' : 'untrusted';
    };

    const handleAction = async (url: string, status: MintStatus) => {
        if (status === 'none') {
            addMintRef.current?.present(url);
        } else if (status === 'untrusted') {
            try { await trustMint(url); } catch (e) { console.error(e); }
        }
    };

    const handleViewProfile = (url: string) => {
        router.push({ pathname: '/(modals)/mint-profile', params: { url } });
    };

    const topMints = nostrMints.slice(0, 5); // Show top 5 cached mints

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <YStack flex={1} bg="$background">
                {/* Search Bar Trigger */}
                <XStack px="$4" py="$3">
                    <XStack
                        flex={1}
                        bg="$gray2"
                        rounded="$4"
                        px="$3"
                        height={50}
                        items="center"
                        gap="$2"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/(modals)/search');
                        }}
                    >
                        <Search size={20}
                            fontWeight="700"
                            color="$gray10" />
                        <Text color="$gray10" pr="$3" flex={1} text="center">Search mints & people</Text>
                    </XStack>
                </XStack>

                <ScrollView
                    flex={1}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={handleRefresh}
                            tintColor="#FFD700"
                        />
                    }
                >






                    {/* Top Mints Section */}
                    <YStack >
                        <XStack justify="space-between" px="$4">
                            <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Discover Top Mints</H6>
                            <Button size="$2" chromeless onPress={() => router.push('/(modals)/discover-mints')}>
                                See All
                            </Button>
                        </XStack>

                        {topMints.length === 0 ? (
                            <MintEmptyState isLoading={isLoading} activeTab="all" />
                        ) : (
                            <MintList
                                mints={topMints}
                                getMintStatus={getMintStatus}
                                onAction={handleAction}
                                onViewProfile={handleViewProfile}
                            />
                        )}
                    </YStack>

                    {/* Contacts Section */}
                    <YStack px="$4" mt="$2">
                        <ContactsView />
                    </YStack>
                    <YStack height={80} />
                </ScrollView>

                <AddMintModal ref={addMintRef} />
            </YStack>
        </SafeAreaView>
    );
}