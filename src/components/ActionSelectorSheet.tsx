import React, { useImperativeHandle, forwardRef, useState, useRef, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, View, Button } from 'tamagui';
import { Send, Lock, Zap, ScanLine, ArrowDownToLine, QrCode, Landmark, X, HandCoins } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

export type ActionSheetType = 'mint' | 'send' | 'receive';

export interface ActionSelectorSheetRef {
    present: (type: ActionSheetType) => void;
    dismiss: () => void;
}

interface ActionSelectorSheetProps { }

interface OptionConfig {
    key: string;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    path?: string;
    disabled?: boolean;
}

const ActionSelectorSheet = forwardRef<ActionSelectorSheetRef, ActionSelectorSheetProps>((props, ref) => {
    const router = useRouter();
    const toast = useToastController();
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const [type, setType] = useState<ActionSheetType | null>(null);

    useImperativeHandle(ref, () => ({
        present: (sheetType: ActionSheetType) => {
            setType(sheetType);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sheetRef.current?.present();
        },
        dismiss: () => {
            sheetRef.current?.dismiss();
        }
    }));

    const title = useMemo(() => {
        if (type === 'mint') return 'Mint/Melt';
        if (type === 'send') return 'Ecash';
        if (type === 'receive') return 'Ecash';
        return 'Select Option';
    }, [type]);

    const options = useMemo<OptionConfig[]>(() => {
        if (type === 'mint') {
            return [
                {
                    key: 'deposit_ln',
                    label: 'Deposit via BTC LN',
                    subtitle: 'Fund your wallet using Lightning Network',
                    icon: <Zap size={24} color="$yellow10" />,
                    iconBg: '$yellow4',
                    path: '/mint',
                },
                {
                    key: 'deposit_chain',
                    label: 'Deposit via BTC on chain',
                    subtitle: 'Fund wallet using Bitcoin On-chain (in dev)',
                    icon: <Landmark size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    disabled: true,
                },
                {
                    key: 'withdraw_ln',
                    label: 'Withdraw via BTC LN',
                    subtitle: 'Withdraw to any Lightning invoice or address',
                    icon: <Zap size={24} color="$orange10" />,
                    iconBg: '$orange4',
                    path: '/(modals)/melt',
                },
                {
                    key: 'withdraw_chain',
                    label: 'Withdraw via BTC on chain',
                    subtitle: 'Withdraw to a Bitcoin on-chain address (in dev)',
                    icon: <Landmark size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    disabled: true,
                }
            ];
        }

        if (type === 'send') {
            return [
                {
                    key: 'standard',
                    label: 'Standard Send',
                    subtitle: 'Create a shareable ecash token link',
                    icon: <Send size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$blue4',
                    path: '/(modals)/send?mode=standard',
                },

                {
                    key: 'p2pk',
                    label: 'P2PK Lock',
                    subtitle: "Secure token to a recipient's public key",
                    icon: <Lock size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$purple4',
                    path: '/(modals)/send?mode=p2pk',
                },
                {
                    key: 'nostr',
                    label: 'Nostr DM',
                    subtitle: 'Send tokens directly to a Nostr contact',
                    icon: <Zap size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$pink4',
                    path: '/(modals)/send?mode=nostr',
                },
                {
                    key: 'scan',
                    label: 'Scan & Pay',
                    subtitle: 'Scan a Cashu token or payment request',
                    icon: <ScanLine size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$green4',
                    path: '/(modals)/send?mode=scan',
                }
            ];
        }

        if (type === 'receive') {
            return [
                {
                    key: 'receive',
                    label: 'Receive Ecash',
                    subtitle: 'Paste or scan a Cashu token to claim instantly',
                    icon: <ArrowDownToLine size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$blue4',
                    path: '/(modals)/receive?mode=receive',
                },
                {
                    key: 'request',
                    label: 'Request Payment',
                    subtitle: 'Generate a QR code or Lightning invoice to receive funds',
                    icon: <HandCoins size={24} color="$gray12" strokeWidth={3} />,
                    iconBg: '$orange4',
                    path: '/(modals)/receive?mode=request',
                }
            ];
        }

        return [];
    }, [type]);

    const handleOptionPress = (option: OptionConfig) => {
        if (option.disabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            toast.show('In Development', {
                message: 'This feature is in development and will be available soon.',
            });
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sheetRef.current?.dismiss();
        if (option.path) {
            router.push(option.path as any);
        }
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sheetRef.current?.dismiss();
    };

    // Calculate snap points based on the number of options
    const snapPoints = useMemo(() => {
        if (type === 'mint') return ['65%'];
        if (type === 'receive') return ['40%'];
        if (type === 'send') return ['60%'];
        return ['50%'];
    }, [type]);

    return (
        <AppBottomSheet ref={sheetRef} snapPoints={snapPoints} backgroundColor="$gray1">
            <YStack p="$4" pt="$2" gap="$4">
                {/* Custom Header with centered Title and close button in top right */}
                <XStack items="center" justify="center" position="relative" width="100%" pb="$2">
                    <Text fontSize="$5" fontWeight="800" bg="$gray6" px='$3' py='$2' rounded='$10' color="$accent1">
                        {title}
                    </Text>
                    <Button
                        position="absolute"
                        r={0}
                        circular
                        size="$3"
                        bg="$gray5"
                        pressStyle={{ scale: 0.95, bg: '$gray5' }}
                        icon={<X size={18} color="$color" strokeWidth={3} />}
                        onPress={handleClose}
                    />
                </XStack>

                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <YStack gap="$2" pb="$4">
                        {options.map((option) => (
                            <XStack
                                key={option.key}
                                p="$3"
                                bg="$gray3"
                                rounded="$6"
                                items="center"
                                gap="$3"
                                pressStyle={{ scale: 0.98, bg: '$gray4' }}
                                onPress={() => handleOptionPress(option)}
                                opacity={option.disabled ? 0.6 : 1}
                            >
                                <View
                                    bg="$gray5"
                                    p="$3"
                                    rounded={10}
                                    items="center"
                                    justify="center"

                                >
                                    {option.icon}
                                </View>
                                <YStack flex={1} gap="$1">
                                    <Text fontWeight="700" fontSize="$5" color="$accent3">
                                        {option.label}
                                    </Text>
                                    <Text fontSize="$3" color="$gray10" lineHeight={16}>
                                        {option.subtitle}
                                    </Text>
                                </YStack>
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
