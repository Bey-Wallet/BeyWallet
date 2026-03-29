import React from 'react';
import { XStack, Button, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';

export type TabKey = 'all' | 'my';

interface MintTabBarProps {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All Mints' },
    { key: 'my', label: 'My Mints' },
];

export function MintTabBar({ activeTab, onTabChange }: MintTabBarProps) {
    return (
        <XStack px="$4" pt="$3" pb="$2" gap="$2">
            {TABS.map(({ key, label }) => (
                <Button
                    key={key}
                    size="$3"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onTabChange(key);
                    }}
                    bg={activeTab === key ? '$accent9' : '$gray3'}
                    rounded="$10"
                    px="$4"
                    borderWidth={0}
                >
                    <Text
                        fontWeight="700"
                        fontSize="$3"
                        color={activeTab === key ? 'white' : '$gray10'}
                    >
                        {label}
                    </Text>
                </Button>
            ))}
        </XStack>
    );
}
