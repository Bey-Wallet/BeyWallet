import React, { useImperativeHandle, forwardRef, useState, useRef, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, View, Button, Input } from 'tamagui';
import { useWalletStore } from '~/store/walletStore';
import { nip19 } from 'nostr-tools';
import {
    Send,
    Lock,
    Zap,
    ScanLine,
    X,
    HandCoins,
    Users,
    KeyRound,
    ChevronLeft,
    Clipboard,
    Bitcoin,
    Banknote,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { LayoutAnimation } from 'react-native';
import { useToastController } from '@tamagui/toast';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import * as ClipboardAPI from 'expo-clipboard';
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
    const inputTextRef = useRef('');
    const inputRef = useRef<any>(null);
    const [hasText, setHasText] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const resolveNip05 = async (address: string): Promise<{ npub: string; username: string } | null> => {
        try {
            const parts = address.split('@');
            if (parts.length !== 2) return null;
            const name = parts[0];
            const domain = parts[1];
            const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const pubkey = data?.names?.[name];
                if (pubkey) {
                    const npub = nip19.npubEncode(pubkey);
                    return { npub, username: name };
                }
            }
        } catch (e) {
            console.warn('NIP-05 resolution failed:', e);
        }
        return null;
    };

    const processInput = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) {
            setValidationError(null);
            return;
        }

        setValidationError(null);
        const lower = trimmed.toLowerCase();

        const clearInput = () => {
            inputTextRef.current = '';
            inputRef.current?.clear();
            setHasText(false);
        };

        // 1. Cashu Token (cashuA... / cashuB... / cashu:...)
        const isCashuToken = lower.startsWith('cashua') || lower.startsWith('cashub') || lower.startsWith('cashu:');
        if (isCashuToken) {
            let normalized = trimmed;
            if (lower.startsWith('cashu:')) {
                normalized = trimmed.slice(6);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            router.push({
                pathname: '/(modals)/receive',
                params: { mode: 'receive', scannedToken: normalized }
            });
            return;
        }

        // 2. Share Link (bey.cash/c#... or bey.cash/c/...)
        if (lower.includes('/c#') || lower.includes('/c/#') || lower.includes('/c/')) {
            let extracted = trimmed;
            const markers = ['/c/#', '/c#', '/c/'];
            for (const marker of markers) {
                const idx = lower.indexOf(marker);
                if (idx !== -1) {
                    extracted = trimmed.slice(idx + marker.length);
                    break;
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            router.push({
                pathname: '/(modals)/receive',
                params: { mode: 'receive', scannedToken: extracted }
            });
            return;
        }

        // 3. Cashu Request (creq...)
        const isPaymentRequest = lower.startsWith('creq');
        if (isPaymentRequest) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            router.push({
                pathname: '/(modals)/send',
                params: { paymentRequest: trimmed }
            });
            return;
        }

        // 3b. Share Request Link (bey.cash/r#... or bey.cash/r/...)
        if (lower.includes('/r#') || lower.includes('/r/#') || lower.includes('/r/')) {
            let extracted = trimmed;
            const markers = ['/r/#', '/r#', '/r/'];
            for (const marker of markers) {
                const idx = lower.indexOf(marker);
                if (idx !== -1) {
                    extracted = trimmed.slice(idx + marker.length);
                    break;
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            router.push({
                pathname: '/(modals)/send',
                params: { paymentRequest: extracted }
            });
            return;
        }

        // 4. Nostr NPUB / Nprofile / Nevent
        if (lower.startsWith('npub1') || lower.startsWith('nprofile1') || lower.startsWith('nevent1') || lower.startsWith('naddr1')) {
            try {
                let targetNpub = trimmed;
                if (!lower.startsWith('npub1')) {
                    const decoded = nip19.decode(trimmed);
                    if (decoded.type === 'nprofile') {
                        const data = decoded.data as any;
                        targetNpub = nip19.npubEncode(data.pubkey);
                    } else {
                        throw new Error('Unsupported Nostr type');
                    }
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                sheetRef.current?.dismiss();
                clearInput();
                router.push({
                    pathname: '/(modals)/send',
                    params: { mode: 'nostr', to: targetNpub }
                });
                return;
            } catch (e) {
                setValidationError('Invalid Nostr identifier');
                return;
            }
        }

        // 5. Lightning Invoice (lnbc... / lntb...)
        const isBolt11 = lower.startsWith('lnbc') || lower.startsWith('lntb') || lower.startsWith('lightning:lnbc') || lower.startsWith('lightning:lntb');
        if (isBolt11) {
            let normalized = trimmed;
            if (lower.startsWith('lightning:')) {
                normalized = trimmed.slice(10);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            useWalletStore.getState().setScannerResult(normalized);
            router.push('/(modals)/melt');
            return;
        }

        // 6. Bitcoin On-chain Address (Legacy 1..., P2SH 3..., Bech32 bc1...)
        const isBitcoinAddress = /^(1|3|bc1|[13].*|[bB][cC]1)[a-zA-Z0-9]{25,62}$/.test(trimmed);
        if (isBitcoinAddress) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            clearInput();
            useWalletStore.getState().setScannerResult(trimmed);
            router.push('/(modals)/melt?mode=onchain');
            return;
        }

        // 7. Username / NIP-05 address (e.g. name@domain.com)
        if (trimmed.includes('@')) {
            const isBeyCash = lower.endsWith('@bey.cash');
            setIsValidating(true);
            const resolved = await resolveNip05(trimmed);
            setIsValidating(false);
            if (resolved) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                sheetRef.current?.dismiss();
                clearInput();
                router.push({
                    pathname: '/(modals)/send',
                    params: { mode: 'nostr', to: resolved.npub, username: resolved.username }
                });
                return;
            } else {
                if (isBeyCash) {
                    setValidationError('Username not found on bey.cash');
                    return;
                }
                // If NIP-05 fails and it's not a bey.cash domain, treat as a Lightning Address and redirect to Melt
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                sheetRef.current?.dismiss();
                clearInput();
                useWalletStore.getState().setScannerResult(trimmed);
                router.push('/(modals)/melt');
                return;
            }
        }

        // 8. Plain username (e.g. satoshi or jack) - check on bey.cash directory
        if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            setIsValidating(true);
            const resolved = await resolveNip05(`${trimmed}@bey.cash`);
            setIsValidating(false);
            if (resolved) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                sheetRef.current?.dismiss();
                clearInput();
                router.push({
                    pathname: '/(modals)/send',
                    params: { mode: 'nostr', to: resolved.npub, username: resolved.username }
                });
                return;
            }
        }

        // If none matches
        setValidationError('Unrecognized token or address format');
    };

    const handlePaste = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const text = await ClipboardAPI.getStringAsync();
            if (text && text.trim()) {
                inputTextRef.current = text.trim();
                inputRef.current?.setNativeProps({ text: text.trim() });
                setHasText(true);
                await processInput(text.trim());
            } else {
                toast.show('Clipboard Empty', { message: 'No text found in clipboard.' });
            }
        } catch (e) {
            console.error('Failed to read clipboard:', e);
        }
    };

    const handleInputChange = (text: string) => {
        inputTextRef.current = text;
        const empty = !text.trim();
        if (empty !== !hasText) {
            setHasText(!empty);
        }
        if (empty) {
            setValidationError(null);
        }
    };

    useImperativeHandle(ref, () => ({
        present: (sheetType: ActionSheetType) => {
            setType(sheetType);
            setStage('main');
            inputTextRef.current = '';
            inputRef.current?.clear();
            setHasText(false);
            setValidationError(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sheetRef.current?.present();
        },
        dismiss: () => {
            inputTextRef.current = '';
            inputRef.current?.clear();
            setHasText(false);
            setValidationError(null);
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
                    icon: <Bitcoin size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    path: '/mint?mode=onchain',
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
                    icon: <Bitcoin size={24} color="$gray10" />,
                    iconBg: '$gray4',
                    path: '/(modals)/melt?mode=onchain',
                }
            ];
        }

        if (type === 'send') {
            if (stage === 'main') {
                return [
                    {
                        key: 'ecash',
                        label: 'Ecash',
                        icon: <Banknote size={24} color="$accent1" />,
                        iconBg: '$accent2',
                        onPressCustom: () => transitionTo('ecash'),
                    },
                    {
                        key: 'lightning',
                        label: 'Lightning',
                        icon: <Zap size={24} color="$accent1" />,
                        iconBg: '$yellow2',
                        path: '/(modals)/melt',
                    },
                    {
                        key: 'onchain',
                        label: 'On-chain',
                        icon: <Bitcoin size={24} color="$accent1" />,
                        iconBg: '$gray2',
                        path: '/(modals)/melt?mode=onchain',
                    }
                ];
            } else {
                return [
                    {
                        key: 'standard',
                        label: 'Create Ecash',
                        icon: <Send size={24} color="$accent1" strokeWidth={2.5} />,
                        iconBg: '$blue4',
                        path: '/(modals)/send?mode=standard',
                    },
                    {
                        key: 'p2pk',
                        label: 'Lock to Public Key',
                        icon: <KeyRound size={24} color="$accent1" strokeWidth={2.5} />,
                        iconBg: '$purple4',
                        path: '/(modals)/send?mode=p2pk',
                    },
                    {
                        key: 'nostr',
                        label: 'Send via Nostr DM',
                        icon: <Users size={24} color="$accent1" strokeWidth={2.5} />,
                        iconBg: '$pink4',
                        path: '/(modals)/send?mode=nostr',
                    },
                    {
                        key: 'scan',
                        label: 'Scan & Pay',
                        icon: <ScanLine size={24} color="$accent1" strokeWidth={2.5} />,
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
                        icon: <Banknote size={24} color="$accent1" />,
                        iconBg: '$accent2',
                        onPressCustom: () => transitionTo('ecash'),
                    },
                    {
                        key: 'lightning',
                        label: 'Lightning',
                        icon: <Zap size={24} color="$accent1" />,
                        iconBg: '$yellow2',
                        path: '/mint',
                    },
                    {
                        key: 'onchain',
                        label: 'On-chain',
                        icon: <Bitcoin size={24} color="$accent1" />,
                        iconBg: '$gray2',
                        path: '/mint?mode=onchain',
                    }
                ];
            } else {
                return [
                    {
                        key: 'receive',
                        label: 'Paste',
                        icon: <Clipboard size={24} color="$accent1" strokeWidth={2.5} />,
                        iconBg: '$blue4',
                        onPressCustom: async () => {
                            sheetRef.current?.dismiss();
                            try {
                                const text = await ClipboardAPI.getStringAsync();
                                if (text && text.trim()) {
                                    router.push({
                                        pathname: '/(modals)/receive',
                                        params: { mode: 'receive', scannedToken: text.trim() }
                                    });
                                } else {
                                    router.push({
                                        pathname: '/(modals)/receive',
                                        params: { mode: 'receive' }
                                    });
                                    toast.show('Clipboard Empty', { message: 'No text found in clipboard.' });
                                }
                            } catch (e) {
                                router.push({
                                    pathname: '/(modals)/receive',
                                    params: { mode: 'receive' }
                                });
                            }
                        }
                    },
                    {
                        key: 'scan',
                        label: 'Scan',
                        icon: <ScanLine size={24} color="$accent1" strokeWidth={2.5} />,
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
                        icon: <HandCoins size={24} color="$accent1" strokeWidth={2.5} />,
                        iconBg: '$orange4',
                        path: '/(modals)/receive?mode=request',
                    },
                    {
                        key: 'lock',
                        label: 'Lock',
                        icon: <Lock size={24} color="$accent1" strokeWidth={2.5} />,
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
        if (type === 'mint') return ['72%'];
        if (stage === 'main') return ['65%'];
        // Reduce height in 'ecash' sub-stage because the input card is hidden
        if (type === 'receive') return ['58%']; // 4 options
        if (type === 'send') return ['58%']; // 5 options
        return ['55%'];
    }, [type, stage]);

    return (
        <AppBottomSheet ref={sheetRef} snapPoints={snapPoints} backgroundColor="$gray1">
            <YStack flex={1} px="$4"  pb="$0" gap="$4">
                {/* Header configuration */}
                <XStack items="center" justify="space-between" width="100%" pb="$0">
                    {stage === 'ecash' ? (
                        <Button
                            circular
                            size="$3"
                            bg="$gray4"
                            pressStyle={{ scale: 0.95, bg: '$gray5' }}
                            icon={<ChevronLeft size={20} color="$color11" strokeWidth={3} />}
                            onPress={() => transitionTo('main')}
                        />
                    ) : (
                        <Button
                            circular
                            size="$3"
                            bg="$gray4"
                            pressStyle={{ scale: 0.95, bg: '$gray5' }}
                            icon={<X size={20} color="$color11" strokeWidth={3} />}
                            onPress={handleClose}
                        />
                    )}

                    <Text fontSize="$6" fontWeight="800" color="$accent1">
                        {title}
                    </Text>

                    {/* Placeholder keeping the title centered */}
                    <View width={44} height={30} />
                </XStack>

                {/* Universal Input Card */}
                {stage === 'main' && (
                    <YStack rounded="$5" p="$3" minHeight={120} borderWidth={1} borderColor={validationError ? "$red8" : "$gray4"}>
                        <XStack justify="space-between" items="center" mb="$2">
                            <Text color="$gray10" fontSize="$2" fontWeight="600">Enter Token, Address or Username</Text>
                            <XStack gap="$1.5" items="center">
                                {hasText ? (
                                    <>
                                        <Button
                                            size="$2"
                                            circular
                                            chromeless
                                            icon={<X size={14} color="$color" />}
                                            onPress={() => {
                                                inputTextRef.current = '';
                                                inputRef.current?.clear();
                                                setHasText(false);
                                                setValidationError(null);
                                            }}
                                        />
                                        <Button
                                            size="$2"
                                            bg="$accent3"
                                            color="$background"
                                            fontWeight="700"
                                            onPress={() => processInput(inputTextRef.current)}
                                            disabled={isValidating}
                                            pressStyle={{ scale: 0.97, opacity: 0.9 }}
                                        >
                                            {isValidating ? '...' : 'Go'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="$2"
                                        theme="gray"
                                        onPress={handlePaste}
                                        icon={<Clipboard size={12} />}
                                        scaleIcon={1.2}
                                    >
                                        Paste
                                    </Button>
                                )}
                            </XStack>
                        </XStack>
                        <Input
                            ref={inputRef}
                            onChangeText={handleInputChange}
                            placeholder="Paste or type Cashu token, LN invoice/address, Bitcoin address, Npub, or username..."
                            bg="transparent"
                            borderWidth={0}
                            fontSize="$4"
                            color="$color"
                            p={0}
                            flex={1}
                            textAlignVertical="top"
                            placeholderTextColor="$gray8"
                            multiline
                            numberOfLines={3}
                            style={{ padding: 0 }}
                            height={70}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {validationError && (
                            <Text color="$red10" fontSize="$2" fontWeight="600" mt="$1.5" px="$1">
                                {validationError}
                            </Text>
                        )}
                    </YStack>
                )}

                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <YStack gap="$2" pb="$4">
                        {options.map((option) => (
                            <XStack
                                key={option.key}
                                p="$3.5"
                                py="$4"
                                bg="$gray3"
                                rounded="$5"
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
                                    <Text fontWeight="700" fontSize="$5" color="$accent1">
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
