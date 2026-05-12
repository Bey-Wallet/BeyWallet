import React from 'react';
import { XStack, YStack, Text, Button, View } from 'tamagui';
import { ShieldCheck, ShieldOff, Star, MessageSquare } from '@tamagui/lucide-icons';
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

    const hostname = (() => {
        try { return new URL(mint.url).hostname; } catch { return mint.url; }
    })();

    const actionLabel = status === 'trusted' ? 'Added' : status === 'untrusted' ? 'Trust' : 'Add';
    const actionTheme = status === 'trusted' ? 'green' : status === 'untrusted' ? 'orange' : 'accent';

    return (
        <YStack
            width={240}
            minH={200}
            bg="$gray2"
            rounded="$5"
            overflow="hidden"
            borderWidth={0}
            borderColor="$borderColor"
            pressStyle={{ opacity: 0.9 }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewProfile(mint.url);
            }}
        >
            {/* Top half with solid color */}


            {/* Mint Icon overlapping */}
            <XStack items="center" justify="space-between" p="$2" gap="$2" >
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
                    fontSize="$4"
                >
                    {actionLabel}
                </Button>
            </XStack>

            {/* Content */}
            <YStack p="$3" width="100%" flex={1} gap="$2">


                <YStack justify="flex-start" width="100%" items="flex-start" mt="$1">
                    <YStack flex={1}>
                        <Text fontSize="$5" fontWeight="600" numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text fontSize="$3" color="$gray12" numberOfLines={1}>
                            {hostname}
                        </Text>
                        <XStack items="center" gap="$1" mt="$0.5">
                            {status === 'trusted' && <ShieldCheck size={12} color="$green10" />}
                            {status === 'untrusted' && <ShieldOff size={12} color="$orange10" />}
                            <Text fontSize="$1" color="$gray10">
                                {status === 'trusted' ? 'Trusted' : status === 'untrusted' ? 'Untrusted' : 'Not added'}
                            </Text>
                        </XStack>
                    </YStack>


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
        </YStack>
    );
}
