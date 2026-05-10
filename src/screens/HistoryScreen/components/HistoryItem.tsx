import React from 'react';
import { ListItem, Text, XStack, View, YStack } from 'tamagui';
import { RefreshCw, BanknoteArrowUp, BanknoteArrowDown, Landmark, ChevronRight } from '@tamagui/lucide-icons';
import { formatLocalTime } from '~/utils/time';

interface HistoryItemProps {
    id: string;
    type: string;
    amount: number;
    createdAt: number;
    status: string;
    onPress: () => void;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({
    type,
    amount,
    createdAt,
    status,
    onPress
}) => {
    const isOutgoing = type === 'send' || type === 'melt';
    const isPending = status.toLowerCase() === 'pending' || status.toLowerCase() === 'unpaid' || status.toLowerCase() === 'unclaimed';

    let iconColor = isOutgoing ? '$red10' : '$green11';

    let Icon = isOutgoing ? BanknoteArrowUp : BanknoteArrowDown;
    let sign = isOutgoing ? '-' : '+';

    if (isPending) {
        iconColor = '$orange10';
    }

    if (type === 'mint') {
        Icon = Landmark;
    }

    if (type === 'swap') {
        Icon = RefreshCw;
        iconColor = '$blue10';
        sign = '';
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'send': return 'Sent';
            case 'receive': return 'Received';
            case 'receive-request': return 'Payment Request';
            case 'mint': return 'Received (LN)';
            case 'melt': return 'Melted';
            case 'swap': return 'Swapped';
            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    };

    return (
        <ListItem
            hoverStyle={{ bg: '$backgroundHover' }}
            pressStyle={{ bg: '$backgroundPress' }}
            bg="transparent"
            py="$2.5"
            onPress={onPress}
            icon={

                <Icon size={24} strokeWidth={2} color={iconColor as any} />

            }
            title={
                <XStack gap="$2" items="center">
                    <Text fontWeight="700" fontSize="$4">
                        {getTypeLabel(type)}
                    </Text>
                    {status.toLowerCase() !== 'completed' && (
                        <XStack px="$1.5" py="$0.5" bg="$gray5" rounded="$2">
                            <Text fontSize="$1" fontWeight="800" textTransform="uppercase" color="$gray10">
                                {status}
                            </Text>
                        </XStack>
                    )}
                </XStack>
            }
            subTitle={
                <Text fontSize="$2" color="$gray10">
                    {formatLocalTime(createdAt)}
                </Text>
            }
            iconAfter={
                <XStack items="center" gap="$2">
                    <Text
                        fontWeight="800"
                        fontSize="$6"
                        color={iconColor as any}
                    >
                        {sign}{'₿'}{amount}
                    </Text>

                </XStack>
            }
        />
    );
};
