import React from 'react';
import { YStack, Text, YGroup, Separator } from 'tamagui';
import { SettingItem } from './SettingItem';
import { SettingSectionConfig } from './types';

interface SettingSectionProps extends SettingSectionConfig {
    onItemPress?: (id: string) => void;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
    title,
    titleColor = "$gray10",
    items,
    bg = "$gray3",
    onItemPress
}) => {
    return (
        <YStack gap="$2">
            <YGroup rounded="$5" bg={bg} overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                {items.map((item) => (
                    <YGroup.Item key={item.id}>
                        <SettingItem
                            {...item}
                            onPress={item.onPress || (() => onItemPress?.(item.id))}
                        />
                    </YGroup.Item>
                ))}
            </YGroup>
        </YStack>
    );
};
