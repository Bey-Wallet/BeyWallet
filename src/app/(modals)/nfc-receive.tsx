import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YStack, XStack, Text, Button, View, useTheme, Theme, Image } from 'tamagui';
import Blockies from '~/components/UI/Blockies';
import { useWalletStore } from '~/store/walletStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import { useSettingsStore } from '~/store/settingsStore';
import NFCFill2 from '~/components/icons/NFC-fill-2';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';
import * as Haptics from 'expo-haptics';
import { DarkTheme } from '@react-navigation/native';
import { useAppTheme } from '~/context/ThemeContext';
import { Scan } from '@tamagui/lucide-icons';
import NFCFillIcon from '~/components/icons/NFC-fill';
import { router, useFocusEffect } from 'expo-router';
import { nfcService } from '~/services/nfcService';
import { walletService } from '~/services/core';
import { useToastController } from '@tamagui/toast';

export default function NFCReceiveScreen() {
    const theme = useTheme();
    const npub = useSettingsStore(state => state.npub);
    const { username } = useNip05Lookup();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const balances = useWalletStore(s => s.balances);
    const mints = useWalletStore(s => s.mints);

    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');
    const [isNfcEnabled, setIsNfcEnabled] = useState(false);
    const [isNfcSupported, setIsNfcSupported] = useState(true);
    const toast = useToastController();

    const activeMint = mints.find(m => m.mintUrl === activeMintUrl);
    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Unknown Mint';
    const balance = activeMintUrl ? balances[activeMintUrl] || 0 : 0;

    const processTagRef = useRef<any>();

    useFocusEffect(
        useCallback(() => {
            const checkNfc = async () => {
                const supported = await nfcService.init();
                setIsNfcSupported(supported);
                if (supported) {
                    const enabled = await nfcService.isEnabled();
                    setIsNfcEnabled(enabled);
                    if (enabled) {
                        console.log('[NFCReceive] Starting NFC listener');
                        nfcService.startListening((tag) => {
                            console.log('[NFCReceive] Tag discovered via listener:', tag);
                            if (processTagRef.current) {
                                processTagRef.current(tag);
                            }
                        });
                    }
                }
            };
            checkNfc();

            return () => {
                console.log('[NFCReceive] Stopping NFC listener');
                nfcService.stopListening();
            };
        }, [])
    );

    const processTag = async (tag: any) => {
        try {
            const payload = tag.ndefMessage?.[0]?.payload;
            if (!payload) {
                throw new Error('No data found on tag');
            }

            const decoded = new TextDecoder().decode(new Uint8Array(payload));
            console.log('[NFCReceive] Decoded payload:', decoded);

            const tokenMatch = decoded.match(/(cashu[A-Za-z0-9_-]+)/);

            if (tokenMatch) {
                const token = tokenMatch[1];
                console.log('[NFCReceive] Found token:', token.substring(0, 20));

                setProcessing(true);
                setStatus('processing');
                setErrorMessage('');

                await walletService.receive(token);
                setStatus('success');
                toast.show('Success', { message: 'Token received and claimed!' });

                setTimeout(() => {
                    setProcessing(false);
                }, 3000);
            } else {
                throw new Error('No valid Cashu token found on tag');
            }
        } catch (err: any) {
            console.error('[NFCReceive] Error processing tag:', err);
            setStatus('error');
            setErrorMessage(err.message || 'Failed to read NFC tag');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    useEffect(() => {
        processTagRef.current = processTag;
    }, [processTag]);

    const handleReceive = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setProcessing(true);
        setStatus('processing');
        setErrorMessage('');

        try {
            const tag = await nfcService.readNdefTag();
            processTag(tag);
        } catch (err: any) {
            console.error('[NFCReceive] Active read failed:', err);
            setStatus('error');
            setErrorMessage(err.message || 'Failed to read NFC tag');
        }
    };

    const { resolvedTheme } = useAppTheme();

    return (
        <YStack flex={1} bg="$background" p="$4" justify="space-between">
            {/* Card */}
            <Theme inverse >

                <YStack
                    bg="$accent12"
                    p="$3"
                    rounded="$5"
                    borderWidth={1}
                    borderColor="$borderColor"
                    gap="$6"
                    width="100%"
                    justify="space-between"
                    minH={230}
                >
                    {/* Top Row */}
                    <XStack justify="space-between" items="center">
                        <XStack gap="$3" items="center">
                            <Blockies seed={npub || 'default'} size={10} scale={4} style={{ borderRadius: 5 }} />
                            <Text fontSize="$5" fontWeight="700" color="$color">
                                {username || 'Bey Wallet User'}
                            </Text>
                        </XStack>
                        <NFCFill2 size={40} color={theme.color1.val} />
                    </XStack>
                    <View width="100%" justify="center" items="center">

                        <Image alt='bey' source={resolvedTheme === 'dark'
                            ? require('../../assets/icons/bey-logo-black-transparent.png')
                            : require('../../assets/icons/bey-logo-white-transparent.png')}

                            width={250} height={80}
                            resizeMode="contain"
                        />

                    </View>
                    {/* Bottom Row */}
                    <XStack justify="space-between" items="flex-end">
                        <YStack gap="$1">
                            <Text fontSize="$2" color="$gray10" fontWeight="600">Selected Mint</Text>
                            <Text fontSize="$4" fontWeight="700" color="$color" numberOfLines={1} style={{ maxWidth: 150 }}>
                                {mintName}
                            </Text>
                        </YStack>
                        <YStack items="flex-end" gap="$1">
                            <Text fontSize="$2" color="$gray10" fontWeight="600">Balance (sats)</Text>
                            <Text fontSize="$6" fontWeight="900" color="$color">
                                ₿{balance.toLocaleString()}
                            </Text>
                        </YStack>
                    </XStack>
                </YStack>

            </Theme>

            {/* NFC History Section */}
            <YStack flex={1} justify="center">
                <EmptyState
                    icon={<NFCFillIcon size={48} color={isNfcEnabled ? "#2196F3" : theme.color4.val} />}
                    title={isNfcEnabled ? "Ready to Receive" : "NFC is Disabled"}
                    subtitle={isNfcEnabled ? "Keep your device close to receive" : "Please enable NFC in your settings to receive tokens"}
                    isBlue={isNfcEnabled}
                />
            </YStack>

            {/* Bottom Button */}
            <YStack gap="$2">
                <Button
                    variant="outlined"
                    size="$5"
                    chromeless
                    theme="gray"
                    fontWeight="700"
                    icon={<Scan size={24} color={theme.color.val} />}
                    onPress={() => router.replace('/(modals)/scanner')}
                    rounded="$5"
                >
                    Scan QR Instead
                </Button>
                <Button
                    size="$5"
                    fontWeight="700"
                    icon={<NFCFill2 size={24} color={theme.color.val} />}
                    onPress={isNfcEnabled ? handleReceive : () => nfcService.goToNfcSetting()}
                    rounded="$5"
                    theme={isNfcEnabled ? undefined : "gray"}
                >
                    {isNfcEnabled ? "Tap to Receive" : "Turn on NFC"}
                </Button>
            </YStack>

            <ProcessingSheet
                visible={processing}
                status={status}
                title="NFC Receiving"
                detail="Hold your phone near the sender"
                errorMessage={errorMessage}
                variant="nfc"
                onClose={() => setProcessing(false)}
            />
        </YStack>
    );
}

function EmptyState({ icon, title, subtitle, isBlue }: { icon: React.ReactNode; title: string; subtitle: string; isBlue?: boolean }) {
    return (
        <YStack items="center" justify="center" py="$10" gap="$3">
            {icon}
            <Text color={isBlue ? "$blue10" : "$gray9"} fontSize="$5" fontWeight="600">
                {title}
            </Text>
            <Text color="$gray8" fontSize="$3" textAlign="center" maxWidth={260}>
                {subtitle}
            </Text>
        </YStack>
    );
}
