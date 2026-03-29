import React from 'react';
import { XStack, YStack, Text, Button } from 'tamagui';
import { ShieldCheck, ShieldOff, Star, MessageSquare, Zap } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { type MintRecommendation } from '../../../services/mintRecommendationService';
import { MintIcon } from './MintIcon';
import { fetchMintMeta, type MintMetadata } from './mintMeta';

export type MintStatus = 'none' | 'untrusted' | 'trusted';

interface MintListItemProps {
    mint: MintRecommendation;
    status: MintStatus;
    onAction: (url: string, status: MintStatus) => void;
    onViewProfile: (url: string) => void;
}

export function MintListItem({ mint, status, onAction, onViewProfile }: MintListItemProps) {
    const { data: meta } = useQuery<MintMetadata>({
        queryKey: ['mint-meta', mint.url],
        queryFn: () => fetchMintMeta(mint.url),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const displayName = meta?.name || mint.name || (() => {
        try { return new URL(mint.url).hostname; } catch { return mint.url; }
    })();

    const displayDescription = meta?.description || mint.description;

    const hostname = (() => {
        try { return new URL(mint.url).hostname; } catch { return mint.url; }
    })();

    const actionLabel = status === 'trusted' ? 'Added' : status === 'untrusted' ? 'Trust' : 'Add';
    const actionTheme = status === 'trusted' ? 'green' : status === 'untrusted' ? 'orange' : 'accent';

    return (
        <XStack
            px="$4"
            py="$3"
            gap="$3"
            items="center"
            pressStyle={{ bg: '$backgroundPress' }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewProfile(mint.url);
            }}
        >
            <MintIcon url={mint.url} hintIcon={mint.icon} />

            {/* Content */}
            <YStack flex={1} gap="$0.5">
                <XStack items="center" gap="$1.5">
                    <Text fontWeight="700" fontSize="$4" numberOfLines={1} flex={1}>
                        {displayName}
                    </Text>
                    {status === 'trusted' && <ShieldCheck size={14} color="$green10" />}
                    {status === 'untrusted' && <ShieldOff size={14} color="$orange10" />}
                </XStack>
                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                    {hostname}
                </Text>
                {displayDescription ? (
                    <Text fontSize="$2" color="$gray9" numberOfLines={1} mt="$0.5">
                        {displayDescription}
                    </Text>
                ) : null}
                <XStack gap="$3" items="center" mt="$1">
                    {(mint.reviewsCount ?? 0) > 0 && (
                        <XStack items="center" gap="$1">
                            <MessageSquare size={11} color="$gray9" />
                            <Text fontSize="$1" color="$gray9">{mint.reviewsCount}</Text>
                        </XStack>
                    )}
                    {mint.averageRating != null && (
                        <XStack items="center" gap="$1">
                            <Star size={11} color="#FFD700" fill="#FFD700" />
                            <Text fontSize="$1" color="$gray10" fontWeight="600">
                                {mint.averageRating.toFixed(1)}
                            </Text>
                        </XStack>
                    )}
                    {meta?.units && meta.units.length > 0 && (
                        <XStack items="center" gap="$1">
                            <Zap size={11} color="$gray9" />
                            <Text fontSize="$1" color="$gray9">{meta.units.join(', ')}</Text>
                        </XStack>
                    )}
                </XStack>
            </YStack>

            {/* Action button */}
            <Button
                size="$2.5"
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
                fontSize="$2"
            >
                {actionLabel}
            </Button>
        </XStack>
    );
}
