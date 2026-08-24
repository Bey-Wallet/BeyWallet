import React, { useState, useEffect, useRef } from 'react';
import { YStack, XStack, Text, Button, View, useTheme, Theme, Spinner } from 'tamagui';
import Blockies from '~/components/UI/Blockies';
import { useWalletStore } from '~/store/walletStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import { useSettingsStore } from '~/store/settingsStore';
import NFCFill2 from '~/components/icons/NFC-fill-2';
import { ProcessingSheet, ProcessingStatus } from '~/components/UI/ProcessingSheet';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '~/context/ThemeContext';
import { Radio, RadioReceiver, Tag, AlertCircle, CheckCircle2 } from '@tamagui/lucide-icons';
import NFCFillIcon from '~/components/icons/NFC-fill';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import BeyIcon from '~/components/icons/BeyIcon';
import { nfcService } from '~/services/nfcService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { Flex } from '~/components/UI/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { HCESession } from 'react-native-hce';
import { proofService } from '~/services/core/proofService';

type TransferState = 'idle' | 'broadcasting' | 'transferring' | 'transferred' | 'claimed';

export default function NFCSendScreen() {
    const theme = useTheme();
    const npub = useSettingsStore(state => state.npub);
    const { secondaryCurrency } = useSettingsStore();
    const { username } = useNip05Lookup();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const mints = useWalletStore(s => s.mints);
    const insets = useSafeAreaInsets();
    const { resolvedTheme } = useAppTheme();
    const queryClient = useQueryClient();

    const params = useLocalSearchParams<{ token?: string; amount?: string; mintUrl?: string }>();
    const token = params.token || '';
    const amount = params.amount || '0';
    const mintUrl = params.mintUrl || activeMintUrl || '';

    const activeMint = mints.find(m => m.mintUrl === mintUrl);
    const mintName = activeMint?.nickname || activeMint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Ecash Mint';

    const [mode, setMode] = useState<'hce' | 'write'>('hce');
    const [isNfcEnabled, setIsNfcEnabled] = useState(false);
    const [isNfcSupported, setIsNfcSupported] = useState(true);
    const [hceActive, setHceActive] = useState(false);
    const [hceError, setHceError] = useState<string | null>(null);
    const [transferState, setTransferState] = useState<TransferState>('broadcasting');
    const [progress, setProgress] = useState(0);

    const [showSheet, setShowSheet] = useState(false);
    const [sheetStatus, setSheetStatus] = useState<ProcessingStatus>('processing');
    const [sheetMessage, setSheetMessage] = useState('Preparing NFC...');
    const [sheetError, setSheetError] = useState<string | undefined>(undefined);

    const simulationRef = useRef<any>(null);
    const unlistenersRef = useRef<(() => void)[]>([]);
    const pollIntervalRef = useRef<any>(null);
    const isClaimedRef = useRef(false);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = React.useMemo(() => {
        if (!btcData?.price) return '...';
        return currencyService.formatValue(
            currencyService.convertSatsToCurrency(Number(amount), btcData.price),
            secondaryCurrency as CurrencyCode
        );
    }, [amount, btcData?.price, secondaryCurrency]);

    // Check NFC status & start HCE simulation automatically on mount if on Android
    useEffect(() => {
        let isSubscribed = true;

        const setupNfc = async () => {
            const supported = await nfcService.init();
            if (!isSubscribed) return;
            setIsNfcSupported(supported);

            if (supported) {
                const enabled = await nfcService.isEnabled();
                if (!isSubscribed) return;
                setIsNfcEnabled(enabled);

                if (enabled && Platform.OS === 'android' && token) {
                    startHceBroadcast();
                }
            }
        };

        setupNfc();

        return () => {
            isSubscribed = false;
            stopHceBroadcast();
            stopClaimPolling();
        };
    }, [token]);

    const startHceBroadcast = async () => {
        if (!token || Platform.OS !== 'android') return;

        try {
            setHceError(null);
            setTransferState('broadcasting');
            setProgress(15);

            // Clean up prior listeners
            unlistenersRef.current.forEach(u => u());
            unlistenersRef.current = [];

            const session = await nfcService.startHceSimulation(token);
            simulationRef.current = session;
            setHceActive(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Listen for HCE session reader connection and transfer events
            if (session && typeof session.on === 'function') {
                const unlistenConnect = session.on(HCESession.Events.HCE_STATE_CONNECTED, () => {
                    console.log('[NFCSend] Receiver device connected in proximity');
                    setTransferState('transferring');
                    setProgress(65);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                });

                const unlistenRead = session.on(HCESession.Events.HCE_STATE_READ, () => {
                    console.log('[NFCSend] Token NDEF payload successfully read by receiver');
                    setTransferState('transferred');
                    setProgress(100);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    startClaimPolling();
                });

                const unlistenDisconnect = session.on(HCESession.Events.HCE_STATE_DISCONNECTED, () => {
                    console.log('[NFCSend] Receiver device disconnected');
                    if (!isClaimedRef.current) {
                        startClaimPolling();
                    }
                });

                unlistenersRef.current.push(unlistenConnect, unlistenRead, unlistenDisconnect);
            }
        } catch (err: any) {
            console.error('[NFCSend] HCE broadcast error:', err);
            setHceActive(false);
            setTransferState('idle');
            setHceError(err.message || 'Failed to start phone broadcast');
        }
    };

    const stopHceBroadcast = async () => {
        unlistenersRef.current.forEach(u => u());
        unlistenersRef.current = [];
        if (simulationRef.current) {
            await nfcService.stopHceSimulation(simulationRef.current);
            simulationRef.current = null;
        }
        setHceActive(false);
    };

    // Poll the mint to check if the receiver has claimed (spent) the token
    const startClaimPolling = () => {
        if (pollIntervalRef.current || !token) return;

        console.log('[NFCSend] Starting mint claim verification polling...');
        pollIntervalRef.current = setInterval(async () => {
            try {
                const states = await proofService.checkProofStates(token);
                if (states && states.length > 0) {
                    const isSpent = states.some((s: any) => s.state === 'SPENT' || String(s.state).toUpperCase() === 'SPENT');
                    if (isSpent && !isClaimedRef.current) {
                        isClaimedRef.current = true;
                        stopClaimPolling();
                        stopHceBroadcast();

                        console.log('[NFCSend] 🎉 Token confirmed CLAIMED by receiver!');
                        setTransferState('claimed');
                        setProgress(100);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        // Invalidate balance and history caches
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                        queryClient.invalidateQueries({ queryKey: ['balance'] });

                        // Automatically navigate back to details after showing success
                        setTimeout(() => {
                            router.back();
                        }, 1800);
                    }
                }
            } catch (err) {
                console.warn('[NFCSend] Claim poll check error:', err);
            }
        }, 1500);
    };

    const stopClaimPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const handleWriteToTag = async () => {
        if (!token) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await stopHceBroadcast();

        setShowSheet(true);
        setSheetStatus('processing');
        setSheetMessage('Approach physical tag to write...');
        setSheetError(undefined);

        try {
            await nfcService.writeNdefTag(token);
            setSheetStatus('success');
            setSheetMessage('Token written to tag!');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
                setShowSheet(false);
                router.back();
            }, 1500);
        } catch (e: any) {
            console.error('[NFCSend] Write tag error:', e);
            setSheetStatus('error');
            setSheetMessage('NFC Write Failed');
            setSheetError(e.message || 'An error occurred while writing to physical tag.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleCloseSheet = async () => {
        setShowSheet(false);
        if (mode === 'hce' && Platform.OS === 'android') {
            startHceBroadcast();
        }
    };

    return (
        <Flex fill bg="$background" pb={insets.bottom || 16}>
            <Stack.Screen
                options={{
                    title: 'NFC Send',
                    headerTitleAlign: 'center',
                }}
            />

            <YStack flex={1} bg="$background" px="$4" justify="space-between">
                {/* Visual Card */}
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
                                <Text fontSize="$2" color="$gray10" fontWeight="600">Mint</Text>
                                <Text fontSize="$4" fontWeight="700" color="$color" numberOfLines={1} style={{ maxWidth: 150 }}>
                                    {mintName}
                                </Text>
                            </YStack>
                            <YStack items="flex-end" gap="$1">
                                <Text fontSize="$2" color="$gray10" fontWeight="600">Sending Amount</Text>
                                <Text fontSize="$6" fontWeight="900" color="$color">
                                    {currencyService.formatSats(Number(amount || 0))}
                                </Text>
                            </YStack>
                        </XStack>
                    </YStack>
                </Theme>

                {/* NFC Active Broadcast / Transfer Status Section */}
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
                            subtitle="Please enable NFC in your device settings to broadcast or write tokens."
                        />
                    ) : mode === 'write' ? (
                        <EmptyState
                            icon={<Tag size={48} color="$accent10" />}
                            title="Physical Tag Mode"
                            subtitle="Tap the button below to approach and write to an NFC card or sticker."
                        />
                    ) : transferState === 'claimed' ? (
                        <YStack items="center" gap="$3">
                            <CheckCircle2 size={56} color="$green10" />
                            <Text color="$green10" fontSize="$6" fontWeight="800">
                                Token Claimed! 🎉
                            </Text>
                            <Text color="$gray9" fontSize="$3" textAlign="center">
                                Successfully received and claimed by receiver wallet.
                            </Text>
                        </YStack>
                    ) : (
                        <YStack width="100%" items="center" gap="$4">
                            <NFCFillIcon
                                size={52}
                                color={
                                    transferState === 'transferred' ? "$green10"
                                        : transferState === 'transferring' ? "$blue10"
                                            : hceActive ? "#2196F3" : "$orange9"
                                }
                            />

                            <YStack items="center" gap="$1.5" width="100%">
                                <Text color="$color" fontSize="$5" fontWeight="700" textAlign="center">
                                    {transferState === 'transferred' ? "Token Transferred!"
                                        : transferState === 'transferring' ? "Transferring Ecash..."
                                            : hceActive ? "Ready to Tap" : (hceError || "NFC Broadcast Inactive")}
                                </Text>
                                <Text color="$gray9" fontSize="$3" textAlign="center" maxWidth={280}>
                                    {transferState === 'transferred' ? "Waiting for receiver wallet to claim..."
                                        : transferState === 'transferring' ? "Hold phones steady back-to-back"
                                            : hceActive ? "Hold your phone back-to-back near receiver device"
                                                : "Tap retry below to start broadcasting token"}
                                </Text>
                            </YStack>

                            {/* Dynamic Real Progress Bar */}
                            {hceActive && (
                                <YStack width="100%" maxW={280} gap="$2" items="center" mt="$1">
                                    <View
                                        width="100%"
                                        height={6}
                                        bg="$gray4"
                                        rounded="$10"
                                        overflow="hidden"
                                    >
                                        <View
                                            height="100%"
                                            width={`${progress}%`}
                                            bg={transferState === 'transferred' ? "$green10" : "$blue10"}
                                            rounded="$10"
                                        />
                                    </View>

                                    {transferState === 'transferred' && (
                                        <XStack gap="$2" items="center" mt="$1">
                                            <Spinner size="small" color="$green10" />
                                            <Text fontSize="$2" color="$gray10" fontWeight="600">
                                                Verifying claim with mint...
                                            </Text>
                                        </XStack>
                                    )}
                                </YStack>
                            )}
                        </YStack>
                    )}
                </YStack>

                {/* Bottom Mode Select & Trigger Buttons */}
                <YStack gap="$3">
                    {/* Mode Selector Tabs */}
                    {Platform.OS === 'android' && isNfcEnabled && transferState !== 'claimed' && (
                        <XStack gap="$2" bg="$gray2" p="$1" rounded="$5">
                            <Button
                                flex={1}
                                size="$4"
                                bg={mode === 'hce' ? "$color" : "transparent"}
                                color={mode === 'hce' ? "$background" : "$color"}
                                rounded="$4"
                                fontWeight="700"
                                onPress={() => {
                                    setMode('hce');
                                    startHceBroadcast();
                                }}
                                icon={<RadioReceiver size={18} color={mode === 'hce' ? theme.background.val : theme.color.val} />}
                            >
                                Phone to Phone
                            </Button>
                            <Button
                                flex={1}
                                size="$4"
                                bg={mode === 'write' ? "$color" : "transparent"}
                                color={mode === 'write' ? "$background" : "$color"}
                                rounded="$4"
                                fontWeight="700"
                                onPress={() => {
                                    setMode('write');
                                    stopHceBroadcast();
                                    stopClaimPolling();
                                }}
                                icon={<Tag size={18} color={mode === 'write' ? theme.background.val : theme.color.val} />}
                            >
                                Write to Tag
                            </Button>
                        </XStack>
                    )}

                    {/* Primary Trigger Button */}
                    {!isNfcEnabled ? (
                        <Button
                            size="$5"
                            fontWeight="700"
                            icon={<NFCFill2 size={24} color={theme.color.val} />}
                            onPress={() => nfcService.goToNfcSetting()}
                            rounded="$5"
                            theme="gray"
                        >
                            Turn on NFC
                        </Button>
                    ) : transferState === 'claimed' ? (
                        <Button
                            size="$5"
                            fontWeight="800"
                            theme="green"
                            icon={<CheckCircle2 size={22} color="white" />}
                            onPress={() => router.back()}
                            rounded="$5"
                        >
                            Done
                        </Button>
                    ) : mode === 'write' || Platform.OS === 'ios' ? (
                        <Button
                            size="$5"
                            fontWeight="800"
                            theme="accent"
                            icon={<Tag size={22} color="white" />}
                            onPress={handleWriteToTag}
                            rounded="$5"
                        >
                            Write to Physical Tag
                        </Button>
                    ) : (
                        <Button
                            size="$5"
                            fontWeight="800"
                            theme={hceActive ? "gray" : "orange"}
                            icon={<Radio size={22} color={theme.color.val} />}
                            onPress={hceActive ? stopHceBroadcast : startHceBroadcast}
                            rounded="$5"
                        >
                            {hceActive ? "Stop Broadcast" : "Retry Broadcast"}
                        </Button>
                    )}
                </YStack>
            </YStack>

            <ProcessingSheet
                visible={showSheet}
                status={sheetStatus}
                title={sheetMessage}
                errorMessage={sheetError}
                variant="nfc"
                onClose={handleCloseSheet}
            />
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
