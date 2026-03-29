import React from 'react';
import { YStack, Button, Text, Separator } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { type MintRecommendation } from '../../../services/mintRecommendationService';
import { MintListItem, type MintStatus } from './MintListItem';

const PAGE_SIZE = 15;

interface MintListProps {
    mints: MintRecommendation[];
    getMintStatus: (url: string) => MintStatus;
    onAction: (url: string, status: MintStatus) => void;
    onViewProfile: (url: string) => void;
}

export function MintList({ mints, getMintStatus, onAction, onViewProfile }: MintListProps) {
    const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

    // Reset when list changes (e.g. tab switch)
    React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [mints]);

    const displayed = mints.slice(0, visibleCount);
    const hasMore = visibleCount < mints.length;

    return (
        <YStack>
            {displayed.map((mint, idx) => (
                <YStack key={mint.url}>
                    <MintListItem
                        mint={mint}
                        status={getMintStatus(mint.url)}
                        onAction={onAction}
                        onViewProfile={onViewProfile}
                    />
                    {idx < displayed.length - 1 && (
                        <Separator mx="$4" borderColor="$borderColor" opacity={0.4} />
                    )}
                </YStack>
            ))}

            {hasMore && (
                <Button
                    mx="$4"
                    my="$4"
                    size="$3"
                    bg="$gray3"
                    borderWidth={0}
                    rounded="$4"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setVisibleCount(c => c + PAGE_SIZE);
                    }}
                >
                    <Text fontWeight="700" fontSize="$3" color="$gray11">
                        Load More ({mints.length - visibleCount} remaining)
                    </Text>
                </Button>
            )}
        </YStack>
    );
}
