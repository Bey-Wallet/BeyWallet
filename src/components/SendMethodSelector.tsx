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
    Link,
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
    standard: <Send size={16} strokeWidth={3} color="$color" />,
    p2pk: <Lock size={16} strokeWidth={3} color="$color" />,
    nostr: <Zap size={16} strokeWidth={3} color="$color" />,
    scan: <ScanLine size={16} strokeWidth={3} color="$color" />,
};

export default function SendMethodSelector({
    mode,
    onSelect,
    isLoading,
}: SendMethodSelectorProps) {
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const handleSelect = (selectedMode: SendMode) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelect(selectedMode);
        sheetRef.current?.dismiss();
    };

    return (
        <>
            {/* Pill button shown in the nav header */}
            <Button
                size="$3"
                theme={({ standard: 'white', p2pk: 'orange', nostr: 'pink', scan: 'green' } as const)[mode]}
                px={isLoading ? '$3' : '$3'}
                borderWidth={1}
                disabled={isLoading}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                    sheetRef.current?.present();
                }}
                gap="$1"
                rounded="$10"
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
                icon={
                    <View


                    >
                        {isLoading ? (
                            <Spinner color="$color10" />
                        ) : (
                            MODE_ICONS[mode]
                        )}
                    </View>

                }
                iconAfter={
                    isLoading ? undefined : (
                        <View


                        >
                            <ChevronDown strokeWidth={2.5} color="$color" />
                        </View>
                    )
                }
                textProps={{
                    fontSize: '$4',
                    fontWeight: '700',

                    numberOfLines: 1,
                }}
                ellipse
            >
                {isLoading ? 'Loading...' : MODE_LABELS[mode]}
            </Button>

            {/* Bottom sheet with method list */}
            <AppBottomSheet ref={sheetRef} snapPoints={["44%"]}>
                <YStack p="$4" pt="$2" gap="$4">
                    <YStack gap="$1" mb="$1">
                        <Text fontSize="$6" text="center" color="$accent5" fontWeight="800">
                            Send Method
                        </Text>

                    </YStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$3" pb="$4" px="$3">
                            {SEND_METHODS.map((method) => {
                                const isActive = method.key === mode;
                                const isDisabled = method.comingSoon;

                                return (
                                    <XStack justify="space-between" opacity={isDisabled ? 0.5 : 1} onPress={() => handleSelect(method.key)} key={method.key}>
                                        <XStack gap="$3" items="center">
                                            <View
                                                bg={'$gray4'}
                                                p="$3"
                                                rounded="$10"
                                                width={50}
                                                height={50}
                                                items="center"
                                                justify="center"
                                            >
                                                {method.icon}
                                            </View>
                                            <Text
                                                fontWeight="700"
                                                fontSize="$6"
                                                numberOfLines={1}
                                                color={'$color'}
                                            >
                                                {method.label}
                                            </Text>
                                        </XStack>
                                        <XStack items="center" justify="center">
                                            {isActive ? (
                                                <View bg="$accent4" p="$1.5" rounded="$10">
                                                    <Check size={14} color="$accent10" strokeWidth={3} />
                                                </View>
                                            ) : undefined}

                                        </XStack>
                                    </XStack>
                                );
                            })}
                        </YStack>
                    </BottomSheetScrollView>
                </YStack>
            </AppBottomSheet>
        </>
    );
}
