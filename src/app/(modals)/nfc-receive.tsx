import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YStack, XStack, Text, Button, View, useTheme, Theme, Spinner } from 'tamagui';
import Blockies from '~/components/UI/Blockies';
import { useWalletStore } from '~/store/walletStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import { useSettingsStore } from '~/store/settingsStore';
import NFCFill2 from '~/components/icons/NFC-fill-2';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '~/context/ThemeContext';
import { Scan, CheckCircle2, AlertCircle, RefreshCw } from '@tamagui/lucide-icons';
import NFCFillIcon from '~/components/icons/NFC-fill';
import { router, useFocusEffect, Stack } from 'expo-router';
import BeyIcon from '~/components/icons/BeyIcon';
import { nfcService } from '~/services/nfcService';
import { walletService } from '~/services/core';
import { decodeToken } from '~/services/core/tokenUtils';
import { useToastController } from '@tamagui/toast';
import { Flex } from '~/components/UI/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { currencyService } from '~/services/currencyService';

type ReceiveState = 'idle' | 'reading' | 'claiming' | 'success' | 'error';

export default function NFCReceiveScreen() {
    const theme = useTheme();
    const npub = useSettingsStore(state => state.npub);
    const { username } = useNip05Lookup();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const balances = useWalletStore(s => s.balances);
    const mints = useWalletStore(s => s.mints);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const queryClient = useQueryClient();

    const [receiveState, setReceiveState] = useState<ReceiveState>('idle');
    const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
    const [receivedMint, setReceivedMint] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isNfcEnabled, setIsNfcEnabled] = useState(false);
    const [isNfcSupported, setIsNfcSupported] = useState(true);
    const toast = useToastController();

    const activeMint = mints.find(m => m.mintUrl === activeMintUrl);
    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Unknown Mint';
    const balance = activeMintUrl ? balances[activeMintUrl] || 0 : 0;

    const processTagRef = useRef<any>();
    const handleReceiveRef = useRef<any>();
    const isProcessingRef = useRef(false);

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

                        // Auto-start active reading session immediately on focus
                        setTimeout(() => {
                            if (handleReceiveRef.current && !isProcessingRef.current) {
                                handleReceiveRef.current();
                            }
                        }, 500);
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
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const ndefMessage = tag.ndefMessage;
            if (!ndefMessage || ndefMessage.length === 0) {
                throw new Error('No NDEF message found on tag');
            }

            const record = ndefMessage[0];
            const payload = record?.payload;
            if (!payload) {
                throw new Error('No data found on tag');
            }

            // Detect record type (tnf + type bytes)
            const tnf = record.tnf;
            const typeArr: number[] = record.type ?? [];
            const isUriRecord = tnf === 1 && typeArr[0] === 0x55;

            let decoded: string;

            if (isUriRecord) {
                const payloadBytes = new Uint8Array(payload);
                const uriPrefix = payloadBytes[0];
                let uriBody = new TextDecoder().decode(payloadBytes.slice(1));
                const prefixes: Record<number, string> = {
                    0x00: '', 0x01: 'http://www.', 0x02: 'https://www.',
                    0x03: 'http://', 0x04: 'https://'
                };
                decoded = (prefixes[uriPrefix] ?? '') + uriBody;
                console.log('[NFCReceive] Decoded URI record:', decoded);
                if (decoded.startsWith('cashu:')) {
                    decoded = decoded.slice(6);
                }
            } else {
                decoded = new TextDecoder().decode(new Uint8Array(payload));
                decoded = decoded.replace(/^[\u0000-\u001F]+(?:en|es|fr|de|it)?/i, '').trim();
                console.log('[NFCReceive] Decoded text record:', decoded);
            }

            // 1. Check for Cashu token
            const tokenMatch = decoded.match(/(cashu[A-Za-z0-9_-]+)/);
            if (tokenMatch) {
                const token = tokenMatch[1];
                console.log('[NFCReceive] Found Cashu token, claiming on-screen...');

                setReceiveState('claiming');
                setErrorMessage('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                // Decode token for amount & mint display
                try {
                    const parsed = decodeToken(token);
                    const amount = parsed.amount ?? parsed.proofs?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) ?? 0;
                    setReceivedAmount(amount);
                    setReceivedMint(parsed.mint || null);
                } catch {
                    // Non-fatal
                }

                await walletService.receive(token);

                setReceiveState('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Refresh balance and history
                queryClient.invalidateQueries({ queryKey: ['history'] });
                queryClient.invalidateQueries({ queryKey: ['balance'] });
                refreshBalance();

                // Seamlessly redirect to the receive details screen after showing the success state
                setTimeout(() => {
                    router.replace({
                        pathname: '/(modals)/receive',
                        params: { scannedToken: token }
                    });
                }, 1400);
                return;
            }

            // 2. Check for NUT-18 Payment Request (creq...)
            const reqMatch = decoded.match(/(creq[a-zA-Z0-9_-]+)/i);
            if (reqMatch) {
                const paymentRequest = reqMatch[1];
                console.log('[NFCReceive] Found NUT-18 payment request, redirecting to send...');
                setReceiveState('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.replace({
                    pathname: '/(modals)/send',
                    params: { paymentRequest }
                });
                return;
            }

            // 3. Check for Lightning Invoice (lnbc...)
            const lnMatch = decoded.match(/(lnbc[a-zA-Z0-9]+)/i) || decoded.match(/lightning:(lnbc[a-zA-Z0-9]+)/i);
            if (lnMatch) {
                const invoice = lnMatch[1];
                console.log('[NFCReceive] Found Lightning invoice, redirecting to send...');
                setReceiveState('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.replace({
                    pathname: '/(modals)/send',
                    params: { paymentRequest: invoice }
                });
                return;
            }

            throw new Error('No valid Cashu token, Payment Request, or Lightning invoice found');
        } catch (err: any) {
            console.error('[NFCReceive] Error processing tag:', err);
            setReceiveState('error');
            setErrorMessage(err.message || 'Failed to process NFC tag');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            isProcessingRef.current = false;
        }
    };

    useEffect(() => {
        processTagRef.current = processTag;
        handleReceiveRef.current = handleReceive;
    }, [processTag, handleReceive]);

    const handleReceive = async () => {
        if (isProcessingRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setReceiveState('reading');
        setErrorMessage('');

        try {
            const tag = await nfcService.readNdefTag();
            processTag(tag);
        } catch (err: any) {
            console.error('[NFCReceive] Active read failed:', err);
            setReceiveState('error');
            setErrorMessage(err.message || 'Failed to read NFC tag');
        }
    };

    const { resolvedTheme } = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <Flex fill bg="$background" pb={insets.bottom || 16}>
            <Stack.Screen
                options={{
                    title: 'NFC Receive',
                    headerTitleAlign: 'center',
                }}
            />

            <YStack flex={1} bg="$background" px="$4" justify="space-between">
                {/* Top Card */}
                <Theme inverse>
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
                            <BeyIcon size={80} color={resolvedTheme === 'dark' ? 'black' : 'white'} />
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

                {/* Inline NFC Receiving Status Section */}
                <YStack flex={1} justify="center" items="center" px="$2">
                    {!isNfcSupported ? (
                        <EmptyState
                            icon={<AlertCircle size={48} color="$red9" />}
                            title="NFC Not Supported"
                            subtitle="Your device does not support NFC features."
                        />
                    ) : !isNfcEnabled ? (
                        <EmptyState
                            icon={<NFCFillIcon size={48} color={theme.color4.val} />}
                            title="NFC is Disabled"
                            subtitle="Please enable NFC in your device settings to receive tokens."
                        />
                    ) : receiveState === 'success' ? (
                        <YStack items="center" gap="$3">
                            <CheckCircle2 size={56} color="$green10" />
                            <Text color="$green10" fontSize="$6" fontWeight="800">
                                {receivedAmount !== null ? `+${currencyService.formatSats(receivedAmount)}` : 'Token Received!'}
                            </Text>
                            <Text color="$gray9" fontSize="$3" textAlign="center">
                                Claimed and added to your wallet. Opening details...
                            </Text>
                        </YStack>
                    ) : receiveState === 'claiming' ? (
                        <YStack items="center" gap="$3">
                            <Spinner size="large" color="$green10" />
                            <Text color="$color" fontSize="$5" fontWeight="700">
                                Claiming Ecash...
                            </Text>
                            <Text color="$gray9" fontSize="$3" textAlign="center">
                                Verifying proofs with mint and depositing to wallet...
                            </Text>
                        </YStack>
                    ) : receiveState === 'reading' ? (
                        <YStack items="center" gap="$3">
                            <Spinner size="large" color="$blue10" />
                            <Text color="$color" fontSize="$5" fontWeight="700">
                                Reading NFC Tag...
                            </Text>
                            <Text color="$gray9" fontSize="$3" textAlign="center">
                                Hold phones steady back-to-back
                            </Text>
                        </YStack>
                    ) : receiveState === 'error' ? (
                        <YStack items="center" gap="$3">
                            <AlertCircle size={52} color="$red10" />
                            <Text color="$red10" fontSize="$5" fontWeight="700" textAlign="center">
                                Receive Failed
                            </Text>
                            <Text color="$gray9" fontSize="$3" textAlign="center" maxWidth={280}>
                                {errorMessage || 'Could not read or claim token. Tap below to retry.'}
                            </Text>
                        </YStack>
                    ) : (
                        <EmptyState
                            icon={<NFCFillIcon size={48} color="#2196F3" />}
                            title="Ready to Receive"
                            subtitle="Hold your phone back-to-back with the sender device"
                            isBlue
                        />
                    )}
                </YStack>

                {/* Bottom Buttons */}
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
                        icon={receiveState === 'error' ? <RefreshCw size={22} color={theme.color.val} /> : <NFCFill2 size={24} color={theme.color.val} />}
                        onPress={isNfcEnabled ? handleReceive : () => nfcService.goToNfcSetting()}
                        rounded="$5"
                        theme={!isNfcEnabled ? "gray" : receiveState === 'error' ? "orange" : undefined}
                    >
                        {!isNfcEnabled ? "Turn on NFC" : receiveState === 'error' ? "Retry Receive" : "Tap to Receive"}
                    </Button>
                </YStack>
            </YStack>
        </Flex>
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
