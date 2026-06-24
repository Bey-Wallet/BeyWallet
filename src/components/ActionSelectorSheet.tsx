import React, { useImperativeHandle, forwardRef, useState, useRef, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, View, Button } from 'tamagui';
import { Send, Lock, Zap, ScanLine, ArrowDownToLine, QrCode, Landmark, X, HandCoins, Scan, Key, Users, KeyRound, Link } from '@tamagui/lucide-icons';
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
        if (type === 'mint') return 'Fund & Withdraw';
        if (type === 'send') return 'Send Ecash';
        if (type === 'receive') return 'Receive Ecash';
        return 'Select Option';
    }, [type]);

    const headerIcon = useMemo(() => {
        if (type === 'mint') return <Zap size={20} color="$accent1" />;
        if (type === 'send') return <Send size={20} color="$accent1" />;
        if (type === 'receive') return <ArrowDownToLine size={20} color="$accent1" />;
        return null;
    }, [type]);

    const options = useMemo<OptionConfig[]>(() => {
        if (type === 'mint') {
            return [
                {
                    key: 'deposit_ln',
                    label: 'Top Up via Lightning',
                    subtitle: 'Convert Bitcoin Lightning into private ecash',
                    icon: <Zap size={24} color="$yellow10" />,
                    iconBg: '$yellow4',
                    path: '/mint',
                },
                {
                    key: 'deposit_chain',
                    label: 'Top Up via On-Chain',
                    subtitle: 'Convert on-chain Bitcoin into private ecash (in dev)',
                    icon: <Landmark size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    disabled: true,
                },
                {
                    key: 'withdraw_ln',
                    label: 'Pay Lightning Invoice',
                    subtitle: 'Melt ecash to pay any Lightning invoice or address',
                    icon: <Zap size={24} color="$orange10" />,
                    iconBg: '$orange4',
                    path: '/(modals)/melt',
                },
                {
                    key: 'withdraw_chain',
                    label: 'Pay to On-Chain Address',
                    subtitle: 'Melt ecash to an on-chain Bitcoin address (in dev)',
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
                    label: 'Create Ecash',
                    subtitle: 'Create a secure ecash token link to send via any chat app',
                    icon: <Send size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$blue4',
                    path: '/(modals)/send?mode=standard',
                },
                {
                    key: 'link',
                    label: 'Create eCash Link',
                    subtitle: 'Generate a short zero-knowledge sharing link via Nostr',
                    icon: <Link size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$yellow4',
                    path: '/(modals)/send?mode=link',
                },
                {
                    key: 'p2pk',
                    label: 'Lock to Public Key',
                    subtitle: 'Secure tokens so only a specific pubkey can claim them (P2PK)',
                    icon: <KeyRound size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$purple4',
                    path: '/(modals)/send?mode=p2pk',
                },
                {
                    key: 'nostr',
                    label: 'Send via Nostr DM',
                    subtitle: 'Deliver ecash directly to a Nostr contact via private message',
                    icon: <Users size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$pink4',
                    path: '/(modals)/send?mode=nostr',
                },
                {
                    key: 'scan',
                    label: 'Scan & Pay',
                    subtitle: 'Scan a QR code, Lightning invoice, or Cashu token',
                    icon: <ScanLine size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$green4',
                    path: '/(modals)/send?mode=scan',
                }
            ];
        }

        if (type === 'receive') {
            return [
                {
                    key: 'receive',
                    label: 'Claim Ecash Token',
                    subtitle: 'Paste or scan a Cashu token to claim it instantly',
                    icon: <ArrowDownToLine size={24} color="$gray12" strokeWidth={2.5} />,
                    iconBg: '$blue4',
                    path: '/(modals)/receive?mode=receive',
                },
                {
                    key: 'request',
                    label: 'Request Payment',
                    subtitle: 'Generate a Cashu request (creq) or Lightning invoice to receive funds',
                    icon: <HandCoins size={24} color="$gray12" strokeWidth={2.5} />,
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
        if (type === 'receive') return ['45%'];
        if (type === 'send') return ['72%'];
        return ['50%'];
    }, [type]);

    return (
        <AppBottomSheet ref={sheetRef} snapPoints={snapPoints} backgroundColor="$gray2">
            <YStack p="$4" pt="$2" gap="$4">
                {/* Custom Header with centered Title and close button in top right */}
                <XStack items="center" justify="space-between" width="100%" pb="$2">
                    <XStack width="$4" height="$4" items="center" justify="center">
                        {headerIcon}
                    </XStack>
                    <Text fontSize="$6" fontWeight="800" color="$accent1">
                        {title}
                    </Text>
                    <Button

                        circular
                        size="$4"
                        bg="$gray5"
                        pressStyle={{ scale: 0.95, bg: '$gray5' }}
                        icon={<X size={20} color="$color" strokeWidth={3} />}
                        onPress={handleClose}
                    />
                </XStack>

                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <YStack gap="$2" pb="$4">
                        {options.map((option) => (
                            <XStack
                                key={option.key}
                                p="$3"
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
