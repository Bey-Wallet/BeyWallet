import React from 'react';
import { YStack, Text, View } from 'tamagui';
import { Sprout } from '@tamagui/lucide-icons';
import { Spinner } from '../../../components/UI/Spinner';
import { type TabKey } from './MintTabBar';

interface MintEmptyStateProps {
    isLoading: boolean;
    activeTab: TabKey;
}

export function MintEmptyState({ isLoading, activeTab }: MintEmptyStateProps) {
    if (isLoading) {
        return (
            <YStack py="$10" items="center" gap="$3">
                <Spinner size="large" />
                <Text color="$gray10" fontSize="$3">Discovering mints…</Text>
            </YStack>
        );
    }

    return (
        <YStack py="$10" items="center" gap="$3" px="$4">
            <View p="$4" bg="$gray2" rounded="$10">
                <Sprout size={32} color="$gray9" />
            </View>
            <YStack items="center">
                <Text fontWeight="700">
                    {activeTab === 'my' ? 'No mints added yet' : 'No mints found'}
                </Text>
                <Text fontSize="$3" color="$gray9" text="center" mt="$1">
                    {activeTab === 'my'
                        ? 'Add mints from the All Mints tab or enter a URL manually.'
                        : 'Pull down to refresh and discover mints from Nostr.'}
                </Text>
            </YStack>
        </YStack>
    );
}
