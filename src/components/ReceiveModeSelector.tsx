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
            icon: <ArrowDownToLine size={18} color="$color" />,
        },
        {
            key: 'request',
            label: 'Request',
            subtitle: 'Generate a payment request QR',
            icon: <QrCode size={18} color="$color" />,
        },
    ];

const MODE_LABELS: Record<ReceiveMode, string> = {
    receive: 'Receive',
    request: 'Request',
};

const MODE_ICONS: Record<ReceiveMode, React.ReactNode> = {
    receive: <ArrowDownToLine size={12} color="$color" />,
    request: <QrCode size={12} color="$color" />,
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
                size="$2.5"
                theme={mode === 'receive' ? 'gray' : 'orange'}
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
                            bg="$gray2"
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
            <AppBottomSheet ref={sheetRef} snapPoints={["38%"]}>
                <YStack p="$4" pt="$2" gap="$4">
                    <YStack gap="$1" mb="$1">
                        <Text fontSize="$6" fontWeight="800">
                            Receive Mode
                        </Text>
                        <Text fontSize="$3" color="$gray10">
                            Choose how you want to receive
                        </Text>
                    </YStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {RECEIVE_METHODS.map((method) => {
                                const isActive = method.key === mode;
                                return (
                                    <ListItem
                                        key={method.key}
                                        size="$4"
                                        px="$3"
                                        hoverTheme
                                        pressTheme
                                        theme="gray"
                                        rounded="$5"
                                        borderWidth={isActive ? 1.5 : 0.5}
                                        borderColor={isActive ? '$accent8' : '$borderColor'}
                                        bg={isActive ? '$accent2' : '$color2'}
                                        onPress={() => handleSelect(method.key)}
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
                                            <Text
                                                fontWeight="700"
                                                fontSize="$4"
                                                numberOfLines={1}
                                                color={isActive ? '$accent11' : '$color'}
                                            >
                                                {method.label}
                                            </Text>
                                        }
                                        subTitle={
                                            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                                                {method.subtitle}
                                            </Text>
                                        }
                                        iconAfter={
                                            isActive ? (
                                                <View bg="$accent4" p="$1.5" rounded="$10">
                                                    <Check size={14} color="$accent10" strokeWidth={3} />
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
