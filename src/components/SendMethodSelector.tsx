import React, { useRef } from 'react';
import {
    Button,
    Text,
    YStack,
    XStack,
    ListItem,
    View,
    Square,
} from 'tamagui';
import {
    ChevronDown,
    Send,
    Lock,
    Zap,
    ScanLine,
    Check,
} from '@tamagui/lucide-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { Spinner } from './UI/Spinner';

export type SendMode = 'standard' | 'p2pk' | 'nostr' | 'scan';

interface SendMethodSelectorProps {
    mode: SendMode;
    onSelect: (mode: SendMode) => void;
    isLoading?: boolean;
}

const SEND_METHODS: {
    key: SendMode;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    comingSoon?: boolean;
}[] = [
        {
            key: 'standard',
            label: 'Standard',
            subtitle: 'Send a Cashu token to anyone',
            icon: <Send size={18} color="$color" />,
        },
        {
            key: 'p2pk',
            label: 'P2PK',
            subtitle: 'Lock token to a public key',
            icon: <Lock size={18} color="$color" />,
        },
        {
            key: 'nostr',
            label: 'Nostr',
            subtitle: 'Send via Nostr DM',
            icon: <Zap size={18} color="$color" />,
            comingSoon: true,
        },
        {
            key: 'scan',
            label: 'Scan & Pay',
            subtitle: 'Scan a Cashu token or payment request',
            icon: <ScanLine size={18} color="$color" />,
        },
    ];

const MODE_LABELS: Record<SendMode, string> = {
    standard: 'Standard',
    p2pk: 'P2PK',
    nostr: 'Nostr',
    scan: 'Scan & Pay',
};

const MODE_ICONS: Record<SendMode, React.ReactNode> = {
    standard: <Send size={12} color="$color" />,
    p2pk: <Lock size={12} color="$color" />,
    nostr: <Zap size={12} color="$color" />,
    scan: <ScanLine size={12} color="$color" />,
};

export default function SendMethodSelector({
    mode,
    onSelect,
    isLoading,
}: SendMethodSelectorProps) {
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const handleSelect = (selectedMode: SendMode) => {
        if (selectedMode === 'nostr') return; // coming soon – blocked
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelect(selectedMode);
        sheetRef.current?.dismiss();
    };

    return (
        <>
            {/* Pill button shown in the nav header */}
            <Button
                size="$2.5"
                theme="gray"
                px={isLoading ? '$3' : '$1.5'}
                borderWidth={1}
                disabled={isLoading}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                    sheetRef.current?.present();
                }}
                maxW={160}
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
                icon={
                    <Square
                        size="$1.5"
                        borderWidth={0.5}
                        borderColor="$borderColor"
                        bg="$color2"
                        rounded="$3"
                    >
                        {isLoading ? (
                            <Spinner size={14} color="$color10" />
                        ) : (
                            MODE_ICONS[mode]
                        )}
                    </Square>

                }
                iconAfter={
                    isLoading ? undefined : (
                        <Square
                            size="$1.5"
                            borderWidth={0.5}
                            borderColor="$borderColor"
                            bg="$color2"
                            rounded="$3"
                        >
                            <ChevronDown size={12} strokeWidth={2.5} color="$color" />
                        </Square>
                    )
                }
                textProps={{
                    fontSize: '$3',
                    fontWeight: '700',
                    maxW: 100,
                    numberOfLines: 1,
                }}
                ellipse
            >
                {isLoading ? 'Loading...' : MODE_LABELS[mode]}
            </Button>

            {/* Bottom sheet with method list */}
            <AppBottomSheet ref={sheetRef}>
                <YStack p="$4" pt="$2" gap="$4">
                    <YStack gap="$1" mb="$1">
                        <Text fontSize="$6" fontWeight="800">
                            Send Method
                        </Text>
                        <Text fontSize="$3" color="$gray10">
                            Choose how you want to send
                        </Text>
                    </YStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {SEND_METHODS.map((method) => {
                                const isActive = method.key === mode;
                                const isDisabled = method.comingSoon;

                                return (
                                    <ListItem
                                        key={method.key}
                                        size="$4"
                                        px="$3"
                                        hoverTheme={!isDisabled}
                                        pressTheme={!isDisabled}
                                        theme="gray"
                                        rounded="$5"
                                        borderWidth={isActive ? 1.5 : 0.5}
                                        borderColor={
                                            isActive ? '$accent8' : '$borderColor'
                                        }
                                        bg={isActive ? '$accent2' : '$color2'}
                                        onPress={
                                            isDisabled
                                                ? undefined
                                                : () => handleSelect(method.key)
                                        }
                                        opacity={isDisabled ? 0.45 : 1}
                                        icon={
                                            <View
                                                bg={isActive ? '$accent4' : '$gray4'}
                                                p="$2"
                                                rounded="$4"
                                                width={40}
                                                height={40}
                                                items="center"
                                                justify="center"
                                            >
                                                {method.icon}
                                            </View>
                                        }
                                        title={
                                            <XStack items="center" gap="$2">
                                                <Text
                                                    fontWeight="700"
                                                    fontSize="$4"
                                                    numberOfLines={1}
                                                    color={
                                                        isActive ? '$accent11' : '$color'
                                                    }
                                                >
                                                    {method.label}
                                                </Text>
                                                {method.comingSoon && (
                                                    <XStack
                                                        bg="$gray5"
                                                        px="$2"
                                                        py="$1"
                                                        rounded="$10"
                                                    >
                                                        <Text
                                                            fontSize="$1"
                                                            fontWeight="700"
                                                            color="$gray10"
                                                            textTransform="uppercase"
                                                            letterSpacing={0.5}
                                                        >
                                                            Coming soon
                                                        </Text>
                                                    </XStack>
                                                )}
                                            </XStack>
                                        }
                                        subTitle={
                                            <Text
                                                fontSize="$2"
                                                color="$gray10"
                                                numberOfLines={1}
                                            >
                                                {method.subtitle}
                                            </Text>
                                        }
                                        iconAfter={
                                            isActive ? (
                                                <View
                                                    bg="$accent4"
                                                    p="$1.5"
                                                    rounded="$10"
                                                >
                                                    <Check
                                                        size={14}
                                                        color="$accent10"
                                                        strokeWidth={3}
                                                    />
                                                </View>
                                            ) : undefined
                                        }
                                    />
                                );
                            })}
                        </YStack>
                    </BottomSheetScrollView>
                </YStack>
            </AppBottomSheet>
        </>
    );
}
