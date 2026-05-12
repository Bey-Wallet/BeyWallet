import React from 'react';
import { ScrollView, XStack, Button, Text, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { type MintRecommendation } from '../../../services/mintRecommendationService';
import { MintListItem, type MintStatus } from './MintListItem';
import { ArrowRight } from '@tamagui/lucide-icons';

const PAGE_SIZE = 15;

interface MintListProps {
    mints: MintRecommendation[];
    getMintStatus: (url: string) => MintStatus;
    onAction: (url: string, status: MintStatus) => void;
    onViewProfile: (url: string) => void;
}

export function MintList({ mints, getMintStatus, onAction, onViewProfile }: MintListProps) {
    const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

    // Reset when list changes
    React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [mints]);

    const displayed = mints.slice(0, visibleCount);
    const hasMore = visibleCount < mints.length;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
        >
            <XStack gap="$3">
                {displayed.map((mint) => (
                    <MintListItem
                        key={mint.url}
                        mint={mint}
                        status={getMintStatus(mint.url)}
                        onAction={onAction}
                        onViewProfile={onViewProfile}
                    />
                ))}

                {hasMore && (
                    <YStack
                        width={200}
                        minHeight={300}
                        bg="$gray3"
                        rounded="$5"
                        items="center"
                        justify="center"
                        gap="$2"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setVisibleCount(c => c + PAGE_SIZE);
                        }}
                    >
                        <ArrowRight size={24} color="$gray10" />
                        <Text fontWeight="700" fontSize="$3" color="$gray10">
                            Load More
                        </Text>
                        <Text fontSize="$2" color="$gray9">
                            {mints.length - visibleCount} remaining
                        </Text>
                    </YStack>
                )}
            </XStack>
        </ScrollView>
    );
}
