import React from 'react';
import { XStack, YStack, Text, Avatar, Button } from 'tamagui';
import { ChevronDown, Sprout } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import { currencyService } from '~/services/currencyService';
import * as Haptics from 'expo-haptics';

interface MintBalanceRowProps {
    activeMint?: {
        icon?: string;
        name?: string;
        nickname?: string;
        mintUrl: string;
    } | null;
    activeMintUrl?: string;
    displayName?: string;
    label?: string;
    balance: number;
    isLoadingMint?: boolean;
    isSelector?: boolean;
    onPress?: () => void;
    showMax?: boolean;
    onMaxPress?: () => void;
    maxDisabled?: boolean;
}

export function MintBalanceRow({
    activeMint,
    activeMintUrl,
    displayName,
    label,
    balance,
    isLoadingMint = false,
    isSelector = true,
    onPress,
    showMax = false,
    onMaxPress,
    maxDisabled = false,
}: MintBalanceRowProps) {
    const resolvedDisplayName = React.useMemo(() => {
        if (displayName) return displayName;
        if (!activeMintUrl && !activeMint) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        if (activeMint?.mintUrl) {
            return activeMint.mintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
        }
        if (activeMintUrl) {
            return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
        }
        return "Select Mint";
    }, [displayName, activeMint, activeMintUrl]);

    const handlePress = () => {
        if (isSelector && onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            onPress();
        }
    };

    return (
        <XStack
            justify="space-between"
            items="center"
            width="100%"
            bg="$gray3"
            p="$4"
            rounded="$6"
        >
            <XStack
                gap="$2"
                items="center"
                onPress={isSelector ? handlePress : undefined}
                pressStyle={isSelector ? { opacity: 0.7 } : undefined}
                flex={1}
            >
                {isLoadingMint ? (
                    <Spinner size="small" color="$accent10" />
                ) : (
                    <Avatar rounded="$3" size="$2">
                        <Avatar.Image src={activeMint?.icon} />
                        <Avatar.Fallback
                            backgroundColor="$gray3"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Sprout size={14} color="$accent10" />
                        </Avatar.Fallback>
                    </Avatar>
                )}
                {label ? (
                    <YStack flex={1}>
                        <Text fontSize="$1" fontWeight="800" color="$gray10" textTransform="uppercase">{label}</Text>
                        <Text fontSize="$3" fontWeight="800" color="$accent6" numberOfLines={1} style={{ maxWidth: 140 }}>
                            {isLoadingMint ? "Loading..." : resolvedDisplayName}
                        </Text>
                    </YStack>
                ) : (
                    <Text fontSize="$4" fontWeight="800" color="$accent6" numberOfLines={1} style={{ maxWidth: 140 }}>
                        {isLoadingMint ? "Loading..." : resolvedDisplayName}
                    </Text>
                )}
                {isSelector && <ChevronDown size={16} color="$gray10" strokeWidth={2.5} />}
            </XStack>

            <XStack gap="$2" items="center">
                <Text fontSize="$4" color="$accent6" fontWeight="800">
                    {currencyService.formatSats(balance)}
                </Text>
                {showMax && (
                    <Button
                        size="$2"
                        rounded="$3"
                        borderWidth={0}
                        color="$color"
                        fontWeight="600"
                        onPress={onMaxPress}
                        disabled={maxDisabled || balance === 0}
                        pressStyle={{ scale: 0.96, bg: "$gray4" }}
                    >
                        Max
                    </Button>
                )}
            </XStack>
        </XStack>
    );
}
