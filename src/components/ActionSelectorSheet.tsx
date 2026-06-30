import React, { useImperativeHandle, forwardRef, useState, useRef, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, View, Button } from 'tamagui';
import {
    Send,
    Lock,
    Zap,
    ScanLine,
    ArrowDownToLine,
    Landmark,
    X,
    HandCoins,
    Users,
    KeyRound,
    Link,
    Coins,
    ChevronLeft,
    Clipboard,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { LayoutAnimation } from 'react-native';
import { useToastController } from '@tamagui/toast';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

export type ActionSheetType = 'mint' | 'send' | 'receive';
export type ActionSheetStage = 'main' | 'ecash';

export interface ActionSelectorSheetRef {
    present: (type: ActionSheetType) => void;
    dismiss: () => void;
}

interface ActionSelectorSheetProps { }

interface OptionConfig {
    key: string;
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    path?: string;
    disabled?: boolean;
    onPressCustom?: () => void;
}

const ActionSelectorSheet = forwardRef<ActionSelectorSheetRef, ActionSelectorSheetProps>((props, ref) => {
    const router = useRouter();
    const toast = useToastController();
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const [type, setType] = useState<ActionSheetType | null>(null);
    const [stage, setStage] = useState<ActionSheetStage>('main');

    useImperativeHandle(ref, () => ({
        present: (sheetType: ActionSheetType) => {
            setType(sheetType);
            setStage('main');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sheetRef.current?.present();
        },
        dismiss: () => {
            sheetRef.current?.dismiss();
        }
    }));

    const transitionTo = (newStage: ActionSheetStage) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setStage(newStage);
    };

    const title = useMemo(() => {
        if (type === 'mint') return 'Fund & Withdraw';
        if (type === 'send') {
            return stage === 'ecash' ? 'Send Ecash' : 'Send';
        }
        if (type === 'receive') {
            return stage === 'ecash' ? 'Receive Ecash' : 'Receive';
        }
        return 'Select Option';
    }, [type, stage]);

    const options = useMemo<OptionConfig[]>(() => {
        if (type === 'mint') {
            return [
                {
                    key: 'deposit_ln',
                    label: 'Top Up via Lightning',
                    icon: <Zap size={24} color="$yellow10" />,
                    iconBg: '$yellow4',
                    path: '/mint',
                },
                {
                    key: 'deposit_chain',
                    label: 'Top Up via On-Chain',
                    icon: <Landmark size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    disabled: true,
                },
                {
                    key: 'withdraw_ln',
                    label: 'Pay Lightning Invoice',
                    icon: <Zap size={24} color="$orange10" />,
                    iconBg: '$orange4',
                    path: '/(modals)/melt',
                },
                {
                    key: 'withdraw_chain',
                    label: 'Pay to On-Chain Address',
                    icon: <Landmark size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    disabled: true,
                }
            ];
        }

        if (type === 'send') {
            if (stage === 'main') {
                return [
                    {
                        key: 'ecash',
                        label: 'Ecash',
                        icon: <Coins size={24} color="$accent10" />,
                        iconBg: '$accent2',
                        onPressCustom: () => transitionTo('ecash'),
                    },
                    {
                        key: 'lightning',
                        label: 'Lightning',
                        icon: <Zap size={24} color="$yellow10" />,
                        iconBg: '$yellow2',
                        path: '/(modals)/melt',
                    },
                    {
                        key: 'onchain',
                        label: 'On-chain',
                        icon: <Landmark size={24} color="$gray10" />,
                        iconBg: '$gray2',
                        disabled: true,
                    }
                ];
            } else {
                return [
                    {
                        key: 'standard',
                        label: 'Create Ecash',
                        icon: <Send size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$blue4',
                        path: '/(modals)/send?mode=standard',
                    },
                    {
                        key: 'link',
                        label: 'Create eCash Link',
                        icon: <Link size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$yellow4',
                        path: '/(modals)/send?mode=link',
                    },
                    {
                        key: 'p2pk',
                        label: 'Lock to Public Key',
                        icon: <KeyRound size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$purple4',
                        path: '/(modals)/send?mode=p2pk',
                    },
                    {
                        key: 'nostr',
                        label: 'Send via Nostr DM',
                        icon: <Users size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$pink4',
                        path: '/(modals)/send?mode=nostr',
                    },
                    {
                        key: 'scan',
                        label: 'Scan & Pay',
                        icon: <ScanLine size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$green4',
                        path: '/(modals)/send?mode=scan',
                    }
                ];
            }
        }

        if (type === 'receive') {
            if (stage === 'main') {
                return [
                    {
                        key: 'ecash',
                        label: 'Ecash',
                        icon: <Coins size={24} color="$accent10" />,
                        iconBg: '$accent2',
                        onPressCustom: () => transitionTo('ecash'),
                    },
                    {
                        key: 'lightning',
                        label: 'Lightning',
                        icon: <Zap size={24} color="$yellow10" />,
                        iconBg: '$yellow2',
                        path: '/mint',
                    },
                    {
                        key: 'onchain',
                        label: 'On-chain',
                        icon: <Landmark size={24} color="$gray10" />,
                        iconBg: '$gray2',
                        disabled: true,
                    }
                ];
            } else {
                return [
                    {
                        key: 'receive',
                        label: 'Paste',
                        icon: <Clipboard size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$blue4',
                        path: '/(modals)/receive?mode=receive',
                    },
                    {
                        key: 'scan',
                        label: 'Scan',
                        icon: <ScanLine size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$green4',
                        onPressCustom: () => {
                            sheetRef.current?.dismiss();
                            router.push({
                                pathname: "/(modals)/scanner",
                                params: { returnTo: "/receive" },
                            });
                        }
                    },
                    {
                        key: 'request',
                        label: 'Request',
                        icon: <HandCoins size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$orange4',
                        path: '/(modals)/receive?mode=request',
                    },
                    {
                        key: 'lock',
                        label: 'Lock',
                        icon: <Lock size={24} color="$gray12" strokeWidth={2.5} />,
                        iconBg: '$purple4',
                        path: '/(modals)/nostr-profile',
                    }
                ];
            }
        }

        return [];
    }, [type, stage, router]);

    const handleOptionPress = (option: OptionConfig) => {
        if (option.disabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            toast.show('In Development', {
                message: 'This feature is in development and will be available soon.',
            });
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (option.onPressCustom) {
            option.onPressCustom();
            return;
        }

        sheetRef.current?.dismiss();
        if (option.path) {
            router.push(option.path as any);
        }
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sheetRef.current?.dismiss();
    };

    // Calculate snap points based on stage and type
    const snapPoints = useMemo(() => {
        if (type === 'mint') return ['65%'];
        if (stage === 'main') return ['45%'];
        if (type === 'receive') return ['58%']; // 4 options
        if (type === 'send') return ['72%']; // 5 options
        return ['50%'];
    }, [type, stage]);

    return (
        <AppBottomSheet ref={sheetRef} snapPoints={snapPoints} backgroundColor="$gray2">
            <YStack p="$4" pt="$2" gap="$4">
                {/* Header configuration */}
                <XStack items="center" justify="space-between" width="100%" pb="$2">
                    {stage === 'ecash' ? (
                        <Button
                            circular
                            size="$4"
                            bg="$gray5"
                            pressStyle={{ scale: 0.95, bg: '$gray5' }}
                            icon={<ChevronLeft size={20} color="$color" strokeWidth={3} />}
                            onPress={() => transitionTo('main')}
                        />
                    ) : (
                        <Button
                            circular
                            size="$4"
                            bg="$gray5"
                            pressStyle={{ scale: 0.95, bg: '$gray5' }}
                            icon={<X size={20} color="$color" strokeWidth={3} />}
                            onPress={handleClose}
                        />
                    )}

                    <Text fontSize="$6" fontWeight="800" color="$accent1">
                        {title}
                    </Text>

                    {/* Placeholder keeping the title centered */}
                    <View width={44} height={44} />
                </XStack>

                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <YStack gap="$2" pb="$4">
                        {options.map((option) => (
                            <XStack
                                key={option.key}
                                p="$3.5"
                                py="$4"
                                bg="$gray4"
                                rounded="$6"
                                items="center"
                                gap="$3"
                                pressStyle={{ scale: 0.98, bg: '$gray4' }}
                                onPress={() => handleOptionPress(option)}
                                opacity={option.disabled ? 0.6 : 1}
                            >
                                <View
                                    p="$2"

                                    rounded="$4"
                                    items="center"
                                    justify="center"
                                >
                                    {option.icon}
                                </View>
                                <XStack flex={1} items="center">
                                    <Text fontWeight="700" fontSize="$5" color="$accent3">
                                        {option.label}
                                    </Text>
                                </XStack>
                            </XStack>
                        ))}
                    </YStack>
                </BottomSheetScrollView>
            </YStack>
        </AppBottomSheet>
    );
});

ActionSelectorSheet.displayName = 'ActionSelectorSheet';

export default ActionSelectorSheet;
