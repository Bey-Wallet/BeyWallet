import React, { useState, useCallback, useMemo, useRef } from 'react';
import { YStack, ScrollView } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { mintRecommendationService, type MintRecommendation } from '../../services/mintRecommendationService';
import { useWalletStore } from '../../store/walletStore';
import { initService } from '../../services/core';
import AddMintModal, { AddMintModalRef } from '../../components/AddMintModal';

import { MintTabBar, type TabKey } from './components/MintTabBar';
import { MintList } from './components/MintList';
import { MintEmptyState } from './components/MintEmptyState';
import { type MintStatus } from './components/MintListItem';

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

export default function ExploreTabScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const addMintRef = useRef<AddMintModalRef>(null);
    const { mints, trustMint } = useWalletStore();
    const [activeTab, setActiveTab] = useState<TabKey>('all');

    // ─── Nostr mint discovery ─────────────────────────────────────────────────
    const {
        data: nostrMints = [],
        isLoading,
        isRefetching,
    } = useQuery<MintRecommendation[]>({
        queryKey: ['mint-recommendations'],
        queryFn: async () => {
            const repo = initService.getRepo();
            const cached = await repo.mintRecommendationRepository.getAll();
            if (cached.length > 0) return cached;
            const discovered = await mintRecommendationService.discoverMints(50);
            if (discovered.length > 0) {
                await repo.mintRecommendationRepository.saveAll(discovered);
            }
            return discovered;
        },
        staleTime: Infinity,
    });

    // ─── Pull-to-refresh ─────────────────────────────────────────────────────
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

    // ─── My mints list ────────────────────────────────────────────────────────
    const myMints: MintRecommendation[] = useMemo(() =>
        mints.map(m => ({
            url: m.mintUrl,
            name: m.nickname || m.name || '',
            description: m.description || '',
            icon: m.icon || '',
            reviewsCount: 0,
            averageRating: null,
        })),
        [mints]
    );

    const sourceList = activeTab === 'all' ? nostrMints : myMints;
    const isEmpty = !isLoading && sourceList.length === 0;

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

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <YStack flex={1} bg="$background">
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
                <MintTabBar activeTab={activeTab} onTabChange={setActiveTab} />

                {(isLoading && nostrMints.length === 0) || isEmpty ? (
                    <MintEmptyState isLoading={isLoading && nostrMints.length === 0} activeTab={activeTab} />
                ) : (
                    <MintList
                        mints={sourceList}
                        getMintStatus={getMintStatus}
                        onAction={handleAction}
                        onViewProfile={handleViewProfile}
                    />
                )}

                <YStack height={80} />
            </ScrollView>

            <AddMintModal ref={addMintRef} />
        </YStack>
    );
}