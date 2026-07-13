import React, { useState } from 'react';
import { YStack, Text, Button, Popover, Separator, ListItem } from 'tamagui';
import { MoreHorizontal } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';

export interface DropdownMenuItem {
    key?: string;
    title: React.ReactNode;
    subTitle?: React.ReactNode;
    icon?: React.ReactNode;
    iconAfter?: React.ReactNode;
    action?: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

export interface AppDropdownMenuProps {
    /** Custom trigger element. Defaults to circular MoreHorizontal button */
    trigger?: React.ReactNode;
    /** Array of menu items to render inside the dropdown */
    items: DropdownMenuItem[];
    /** Popover placement relative to trigger */
    placement?: 'bottom-end' | 'bottom-start' | 'bottom' | 'top-end' | 'top-start';
    /** Custom width of dropdown popover container */
    width?: number | string;
}

export function AppDropdownMenu({
    trigger,
    items,
    placement = 'bottom-end',
    width = 230,
}: AppDropdownMenuProps) {
    const [open, setOpen] = useState(false);

    const defaultTrigger = (
        <Button
            circular
            size="$3"
            chromeless
            icon={<MoreHorizontal size={22} color="$color" />}
            pressStyle={{ opacity: 0.7 }}
        />
    );

    const handleOpenChange = (nextOpen: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setOpen(nextOpen);
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange} size="$5" allowFlip placement={placement}>
            <Popover.Trigger asChild>
                {trigger || defaultTrigger}
            </Popover.Trigger>

            <Popover.Content
                borderWidth={1}
                borderColor="$borderColor"
                enterStyle={{ y: -6, opacity: 0, scale: 0.96 }}
                exitStyle={{ y: -6, opacity: 0, scale: 0.96 }}
                elevate
                padding={0}
                borderRadius="$5"
                bg="$gray2"
                width={width}
                overflow="hidden"
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 6 }}
                shadowRadius={12}
                shadowOpacity={0.2}
            >
                <YStack separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                    {items.map((item, index) => {
                        const isDestructive = item.destructive;
                        const textColor = isDestructive ? '$red10' : item.disabled ? '$gray9' : '$color';

                        return (
                            <ListItem
                                key={item.key || index}
                                title={
                                    typeof item.title === 'string' ? (
                                        <Text fontWeight="600" fontSize="$3.5" color={textColor} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                    ) : (
                                        item.title
                                    )
                                }
                                subTitle={
                                    item.subTitle ? (
                                        typeof item.subTitle === 'string' ? (
                                            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                                                {item.subTitle}
                                            </Text>
                                        ) : (
                                            item.subTitle
                                        )
                                    ) : undefined
                                }
                                icon={item.icon}
                                iconAfter={item.iconAfter}
                                bg="transparent"
                                pressStyle={item.disabled ? undefined : { bg: "$gray3", opacity: 0.8 }}
                                hoverStyle={item.disabled ? undefined : { bg: "$gray2" }}
                                cursor={item.disabled ? 'not-allowed' : 'pointer'}
                                opacity={item.disabled ? 0.5 : 1}
                                py="$3"
                                px="$3.5"
                                onPress={() => {
                                    if (item.disabled) return;
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setOpen(false);
                                    if (item.action) {
                                        item.action();
                                    }
                                }}
                            />
                        );
                    })}
                </YStack>
            </Popover.Content>
        </Popover>
    );
}
