import React from 'react';
import { XStack, YStack, Text, Button, Separator, Theme } from 'tamagui';
import { Copy, ChevronRight, AlertCircle } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';

export function ListTable({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
    return (
        <YStack
            gap="$0"
            bg="$gray2"
            rounded="$5"
            overflow="hidden"
            separator={<Separator borderColor="$borderColor" opacity={0.5} />}
            {...props}
        >
            {children}
        </YStack>
    );
}

export function ListTableRow({
    label,
    value,
    isCopyable,
    copyValue,
    onCopy,
    onPress,
    icon: Icon,
    iconColor,
    rightContent
}: {
    label: string;
    value?: React.ReactNode;
    isCopyable?: boolean;
    copyValue?: string;
    onCopy?: () => void;
    onPress?: () => void;
    icon?: any;
    iconColor?: string;
    rightContent?: React.ReactNode;
}) {
    const toast = useToastController();

    const handleCopy = async () => {
        if (onCopy) {
            onCopy();
            return;
        }
        const textToCopy = copyValue || (typeof value === 'string' ? value : '');
        if (textToCopy) {
            await Clipboard.setStringAsync(textToCopy);
            Haptics.selectionAsync();
            toast.show('Copied!', { message: 'Copied to clipboard' });
        }
    };

    const content = (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <XStack items="center" gap="$2">
                {Icon && <Icon size={18} color={iconColor || "$gray10"} />}
                <Text fontSize="$4" color="$gray10" fontWeight="600">{label}</Text>
            </XStack>
            
            <XStack gap="$2" items="center" flex={1} justify="flex-end">
                {typeof value === 'string' || typeof value === 'number' ? (
                    <Text fontSize="$4" text="right" fontWeight="600" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                        {value}
                    </Text>
                ) : (
                    value
                )}

                {rightContent}

                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={handleCopy} />
                )}
                {onPress && !isCopyable && !rightContent && (
                    <ChevronRight size={16} color="$gray10" />
                )}
            </XStack>
        </XStack>
    );

    if (onPress) {
        return (
            <YStack pressStyle={{ opacity: 0.7, backgroundColor: '$gray3' }} onPress={onPress}>
                {content}
            </YStack>
        );
    }

    return content;
}
