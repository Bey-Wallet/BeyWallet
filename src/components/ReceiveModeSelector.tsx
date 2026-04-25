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
    ArrowDownToLine,
    QrCode,
    Check,
} from '@tamagui/lucide-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { Spinner } from './UI/Spinner';

export type ReceiveMode = 'receive' | 'request';

interface ReceiveModeSelectorProps {
    mode: ReceiveMode;
    onSelect: (mode: ReceiveMode) => void;
    isLoading?: boolean;
}

const RECEIVE_METHODS: {
    key: ReceiveMode;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
}[] = [
        {
            key: 'receive',
            label: 'Receive',
            subtitle: 'Paste or scan a Cashu token',
            icon: <ArrowDownToLine strokeWidth={3} color="$color" />,
        },
        {
            key: 'request',
            label: 'Request',
            subtitle: 'Generate a payment request QR',
            icon: <QrCode strokeWidth={3} color="$color" />,
        },
    ];

const MODE_LABELS: Record<ReceiveMode, string> = {
    receive: 'Receive',
    request: 'Request',
};

const MODE_ICONS: Record<ReceiveMode, React.ReactNode> = {
    receive: <ArrowDownToLine size={16} strokeWidth={3} color="$color" />,
    request: <QrCode size={16} strokeWidth={3} color="$color" />,
};

export default function ReceiveModeSelector({
    mode,
    onSelect,
    isLoading,
}: ReceiveModeSelectorProps) {
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const handleSelect = (selectedMode: ReceiveMode) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelect(selectedMode);
        sheetRef.current?.dismiss();
    };

    return (
        <>
            {/* Pill button shown in the nav header */}
            <Button
                size="$3"
                theme={mode === 'receive' ? 'white' : 'orange'}
                px={isLoading ? '$3' : '$3'}
                borderWidth={1}
                disabled={isLoading}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                    sheetRef.current?.present();
                }}

                rounded="$10"
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
                icon={

                    <View

                    >
                        {isLoading ? (
                            <Spinner size={16} color="$color10" />
                        ) : (
                            MODE_ICONS[mode]
                        )}
                    </View>
                }
                iconAfter={
                    isLoading ? undefined : (
                        <View

                        >
                            <ChevronDown size={20} strokeWidth={3} color="$color" />
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
            <AppBottomSheet ref={sheetRef} snapPoints={["27%"]}>
                <YStack p="$4" pt="$2" gap="$4">
                    <YStack gap="$1" mb="$1">
                        <Text fontSize="$6" text="center" color="$accent5" fontWeight="800">
                            Receive Mode
                        </Text>

                    </YStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$3" pb="$4" px="$3">
                            {RECEIVE_METHODS.map((method) => {
                                const isActive = method.key === mode;
                                return (
                                    <>
                                        <XStack justify="space-between" onPress={() => handleSelect(method.key)} key={method.key}>
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

                                    </>
                                );
                            })}
                        </YStack>
                    </BottomSheetScrollView>
                </YStack>
            </AppBottomSheet>
        </>
    );
}
