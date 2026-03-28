import React from 'react';
import { YStack, Text, YGroup, Separator } from 'tamagui';

interface HistorySectionProps {
    title: string;
    children: React.ReactNode;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
    title,
    children
}) => {
    return (
        <YStack gap="$3" mt="$4">
            <Text fontSize="$4" fontWeight="600" color="$gray10" px="$2">{title}</Text>
            <YGroup rounded="$7" bg="$gray3" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                {children}
            </YGroup>
        </YStack>
    );
};
