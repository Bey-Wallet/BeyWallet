import React, { useState, useMemo, useEffect, useRef } from 'react';
import { YStack, XStack, Text, Button, ScrollView, View, Separator, Circle, Popover, ListItem, Adapt, Sheet, Square } from 'tamagui';
import { ChevronLeft, RefreshCw, Copy, Share2, ArrowUpRight, ArrowDownLeft, Calendar, Coins, Zap, ShieldCheck, ExternalLink, AlertCircle, CheckCircle2, Check, RotateCcw, MoreHorizontal, Link, Contact2, Scan, Trash2, Gauge, ZoomIn, Hexagon, History, X, Ban, CheckCircle, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Share as RNShare } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { Buffer } from 'buffer';
import { formatFullLocalTime, formatRelativeTime } from '~/utils/time';
import { historyService, initService, proofService, cleanToken, decodeToken, encodeToken, encodePeanut, encodeTokenV4, encodeTokenV3, walletService, mintManager } from '~/services/core';
import { nip19 } from 'nostr-tools';
import { PendingTokenLayout } from '~/components/UI/PendingTokenLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner } from '~/components/UI/Spinner';
import { useToastController } from '@tamagui/toast';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { notificationService } from '~/services/notificationService';

// Ensure Buffer is available globally
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

interface HistoryEntry {
    id: string;
    type: 'send' | 'receive' | 'mint' | 'melt';
    amount: number;
    unit: string;
    mintUrl: string;
    state?: string;
    createdAt: number;
    metadata?: any;
    token?: any;
}

export function TransactionDetailsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const toast = useToastController();
    const params = useLocalSearchParams<{ id: string }>();
    const id = params.id?.toString();
    const { secondaryCurrency } = useSettingsStore();

    const { data: entry, refetch, isRefetching } = useQuery({
        queryKey: ['transaction', id],
        queryFn: async () => {
            if (!id) return null;
            const history = await historyService.getHistory(200, 0);
            return (history.find((e: any) => e.id === id) as HistoryEntry) || null;
        },
        enabled: !!id,
    });

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatAmount = useMemo(() => {
        if (!btcData?.price || !entry?.amount) return 0;
        return currencyService.convertSatsToCurrency(entry.amount, btcData.price);
    }, [entry?.amount, btcData?.price]);

    const [token, setToken] = useState<string>('');
    const [isStatusExpanded, setIsStatusExpanded] = useState(false);

    useEffect(() => {
        if (!entry) return;
        console.log('[TransactionDetails] Entry loaded:', entry.id, 'Type:', entry.type);

        // Extract metadata safely
        let metadata = entry.metadata;
        if (typeof entry.metadata === 'string' && entry.metadata.trim().startsWith('{')) {
            try {
                metadata = JSON.parse(entry.metadata);
            } catch (e) {
                console.warn('[TransactionDetails] Failed to parse metadata:', e);
                metadata = {};
            }
        }

        // Priority 1: Token in metadata (already encoded string)
        if (metadata?.token) {
            if (typeof metadata.token === 'string') {
                setToken(metadata.token);
            } else {
                try {
                    const encoded = encodeToken(metadata.token);
                    setToken(encoded);
                } catch (e) {
                    console.warn('[TransactionDetails] Failed to encode metadata token:', e);
                }
            }
            return;
        }

        // Priority 2: Token object or string in entry
        if (entry.token) {
            try {
                let tokenToEncode = entry.token;

                // Handle legacy or nested formats if token is an array
                if (Array.isArray(entry.token) && entry.token.length > 0) {
                    tokenToEncode = entry.token[0];
                }

                const encoded = typeof tokenToEncode === 'string'
                    ? tokenToEncode
                    : encodeToken(tokenToEncode);

                setToken(encoded);
            } catch (e) {
                console.warn('[TransactionDetails] Failed to encode token from entry:', e);
            }
        }
    }, [entry]);

    const status = entry?.state || 'completed';

    // Animated QR states
    const [qrCodeFragment, setQrCodeFragment] = useState<string>('');
    // UR animated QR is opt-in — standard wallets (Minibits, cashu.me, Sovan) expect plain cashu: QR
    const [showAnimatedQR, setShowAnimatedQR] = useState(false);
    const [fragmentLength, setFragmentLength] = useState(150); // L=150, M=100, S=50
    const [intervalMs, setIntervalMs] = useState(140); // F=140, M=250, S=500
    const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>('V4');
    const encoderRef = useRef<UREncoder | null>(null);
    const deleteSheetRef = useRef<AppBottomSheetRef>(null);

    // Initialize/Update token version when token changes
    useEffect(() => {
        if (token && typeof token === 'string') {
            setTokenVersion(token.startsWith('cashuB') ? 'V4' : 'V3');
        }
    }, [token]);

    const [lockedToNpub, setLockedToNpub] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        try {
            const clean = cleanToken(token);
            if (!clean || typeof clean !== 'string') {
                setShowAnimatedQR(false);
                setQrCodeFragment(typeof token === 'string' ? `cashu:${token}` : '');
                setLockedToNpub(null);
                return;
            }

            const decoded = decodeToken(clean);
            const proofs = decoded.proofs || [];

            // Check for P2PK pubkey in the first proof secret
            try {
                if (proofs.length > 0) {
                    const firstSecret = proofs[0]?.secret;
                    if (typeof firstSecret === 'string') {
                        if (firstSecret.startsWith('["P2PK"')) {
                            const parsed = JSON.parse(firstSecret);
                            const hexPubkey = parsed[1]?.data;
                            if (hexPubkey) {
                                setLockedToNpub(nip19.npubEncode(hexPubkey));
                            } else {
                                setLockedToNpub(null);
                            }
                        } else {
                            setLockedToNpub(null);
                        }
                    } else {
                        setLockedToNpub(null);
                    }
                }
            } catch (e) {
                console.warn('[TransactionDetails] Failed to parse P2PK secret:', e);
                setLockedToNpub(null);
            }

            if (showAnimatedQR) {
                // Only build UR encoder when animated mode is explicitly ON
                const { encode: cborEncode } = require('cbor-x');
                const cborBuffer = cborEncode(clean);
                const ur = new UR(Buffer.from(cborBuffer), "cashu");
                encoderRef.current = new UREncoder(ur, fragmentLength, 0);
                setQrCodeFragment(encoderRef.current.nextPart());
            } else {
                // Static plain cashu: QR — compatible with Minibits, cashu.me, Sovan
                setQrCodeFragment(clean.startsWith('cashu:') ? clean : `cashu:${clean}`);
            }
        } catch (e) {
            console.error('[TransactionDetails] Failed to setup QR:', e);
            setShowAnimatedQR(false);
            setQrCodeFragment(typeof token === 'string' ? `cashu:${token}` : '');
        }
    }, [token, fragmentLength, showAnimatedQR]);

    useEffect(() => {
        if (!showAnimatedQR || !encoderRef.current) return;

        const interval = setInterval(() => {
            setQrCodeFragment(encoderRef.current!.nextPart());
        }, intervalMs);

        return () => clearInterval(interval);
    }, [showAnimatedQR, intervalMs]);

    const statusConfig = useMemo(() => {
        if (status === 'claimed' || status === 'completed' || entry?.type === 'receive' || entry?.type === 'mint') {
            return { color: '$green11', bg: '$green3', headerBg: '$green9', icon: CheckCircle2, label: 'Success' };
        }
        if (status === 'pending' || status === 'unclaimed') {
            return { color: '$orange10', bg: '$orange3', headerBg: '$orange9', icon: RefreshCw, label: 'Pending' };
        }
        if (status === 'failed' || status === 'error') {
            return { color: '$red10', bg: '$red3', headerBg: '$red9', icon: AlertCircle, label: 'Failed' };
        }
        return { color: '$gray10', bg: '$gray3', headerBg: '$gray9', icon: AlertCircle, label: status };
    }, [status, entry?.type]);

    const title = useMemo(() => {
        const type = entry?.type;
        if (!type || typeof type !== 'string') return 'Transaction';
        switch (type.toLowerCase()) {
            case 'send': return 'Send Ecash';
            case 'receive': return 'Receive Ecash';
            case 'mint': return 'Mint Ecash';
            case 'melt': return 'Melt Ecash';
            default: return 'Transaction';
        }
    }, [entry?.type]);


    const handleCopyToken = async () => {
        if (token) {
            await Clipboard.setStringAsync(token);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.show('Copied!', { message: 'Token copied to clipboard' });
        }
    };

    const handleCopyEmoji = async () => {
        if (token) {
            const peanut = encodePeanut(cleanToken(token));
            await Clipboard.setStringAsync(peanut);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toast.show('Copied as Emoji!', { message: 'Peanut token copied to clipboard' });
        }
    };

    const handleShare = async () => {
        if (!token) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const shareText = `cashu:${token}`;
        try {
            await RNShare.share({ message: shareText });
        } catch (error) {
            console.error('[TransactionDetails] Error sharing:', error);
            handleCopyToken();
        }
    };

    const handleToggleVersion = () => {
        if (!token) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const decoded = decodeToken(token);
            if (tokenVersion === 'V3') {
                const encodedV4 = encodeTokenV4(decoded);
                setToken(encodedV4);
                setTokenVersion('V4');
                toast.show('Switched to V4', { message: 'Using compact CBOR encoding' });
            } else {
                const encodedV3 = encodeTokenV3(decoded);
                setToken(encodedV3);
                setTokenVersion('V3');
                toast.show('Switched to V3', { message: 'Using standard JSON encoding' });
            }
        } catch (e) {
            console.error('[TransactionDetails] Failed to toggle version:', e);
            toast.show('Error', { message: 'Failed to switch token version' });
        }
    };

    const handleRefresh = async () => {
        if (isRefetching) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (token) {
            try {
                const states = await proofService.checkProofStates(token);
                const isSpent = states.some((s: any) => s.state === 'SPENT');
                const isPending = states.some((s: any) => s.state === 'PENDING');

                let newState = entry?.state;
                if (isSpent) newState = 'claimed';
                else if (isPending) newState = 'pending';
                else newState = 'unclaimed';

                if (entry && newState !== entry.state) {
                    const repo = initService.getRepo();
                    if (repo?.historyRepository) {
                        await (repo.historyRepository as any).updateHistoryEntryState(entry.id, newState);
                    }
                    if (newState === 'claimed' && entry.type === 'send' && entry.state !== 'claimed') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        toast.show('Claimed!', { message: 'The recipient has claimed your ecash' });
                        if (useSettingsStore.getState().notificationsEnabled) {
                            notificationService.sendLocalNotification('Claimed!', 'The recipient has claimed your ecash', { transactionId: entry.id });
                        }
                    }
                }
            } catch (err) {
                console.warn('[TransactionDetails] Failed to refresh proof states:', err);
            }
        }

        await refetch();
        queryClient.invalidateQueries({ queryKey: ['history'] });
    };

    const [isClaiming, setIsClaiming] = useState(false);
    const [mintFee, setMintFee] = useState(0);

    // Fetch fee for this mint
    useEffect(() => {
        if (entry?.mintUrl) {
            mintManager.getFeePpk(entry.mintUrl).then(feePpk => {
                setMintFee(feePpk);
            }).catch(() => setMintFee(0));
        }
    }, [entry?.mintUrl]);

    const handleClaimNow = async () => {
        if (!token || isClaiming) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsClaiming(true);
        try {
            await walletService.receive(token.trim());
            toast.show('Claimed!', { message: 'Tokens added to wallet' });

            // Update state in DB
            const repo = initService.getRepo();
            if (repo?.historyRepository) {
                await (repo.historyRepository as any).updateHistoryEntryState(id!, 'claimed');
            }

            // Wait a bit for DB and then refresh UI
            setTimeout(() => {
                handleRefresh();
            }, 500);

        } catch (err: any) {
            console.error('[TransactionDetails] Claim failed:', err);
            toast.show('Claim Failed', { message: err.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const changeSpeed = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (intervalMs === 250) setIntervalMs(500);
        else if (intervalMs === 500) setIntervalMs(140);
        else setIntervalMs(250);
    };

    const changeSize = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (fragmentLength === 100) setFragmentLength(50);
        else if (fragmentLength === 50) setFragmentLength(150);
        else setFragmentLength(100);
    };

    // Auto-refresh on mount and poll if pending — first check is immediate, then every 2.5s
    useEffect(() => {
        if (!entry || !initService.isInitialized()) return;
        const isPending = status === 'pending' || status === 'unclaimed';
        if (!isPending || entry.type !== 'send') return;

        // Fire immediately, then repeat every 2.5s
        handleRefresh();
        const interval = setInterval(handleRefresh, 2500);

        return () => clearInterval(interval);
    }, [entry?.id, entry?.state]);
    // Status text formatting
    const formattedStatus = useMemo(() => {
        if (!status || typeof status !== 'string') return 'Unknown';
        try {
            return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        } catch (e) {
            return String(status);
        }
    }, [status]);

    const speedLabel = intervalMs === 140 ? "F" : intervalMs === 250 ? "M" : "S";
    const sizeLabel = fragmentLength === 150 ? "L" : fragmentLength === 100 ? "M" : "S";

    if (!entry) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
                <YStack flex={1} bg="$background" items="center" justify="center" p="$4">
                    <Spinner size="large" />
                    <Text mt="$4" color="$gray10">Loading transaction details...</Text>
                </YStack>
            </SafeAreaView>
        );
    }

    const handleDelete = async () => {
        if (!id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await historyService.deleteHistoryEntries([id]);
            toast.show('Deleted', { message: 'Transaction removed from history' });
            deleteSheetRef.current?.dismiss();
            router.back();
            queryClient.invalidateQueries({ queryKey: ['history'] });
        } catch (err) {
            console.error('[TransactionDetails] Delete failed:', err);
            toast.show('Delete Failed', { message: 'Could not remove transaction' });
        }
    };


    const isOutgoing = entry.type === 'send' || entry.type === 'melt';
    const amountColor = isOutgoing ? '$red10' : '$green11';
    const amountSign = isOutgoing ? '-' : '+';

    if (token && typeof token === 'string' && (status === 'pending' || status === 'unclaimed')) {
        return (
            <>
                <Stack.Screen
                    options={{
                        title: 'Pending Ecash',
                        headerRight: () => (
                            <XStack gap="$2">
                                <Button
                                    circular
                                    size="$3"
                                    icon={isRefetching ? <Spinner /> : <RefreshCw size={22} color="$color" />}
                                    chromeless
                                    onPress={handleRefresh}
                                    disabled={isRefetching}
                                />
                                <Button
                                    circular
                                    size="$3"
                                    icon={<Trash2 size={20} color="$red10" />}
                                    chromeless
                                    onPress={() => deleteSheetRef.current?.present()}
                                />
                            </XStack>
                        ),
                    }}
                />
                <ScrollView p="$4" pb="$8" bg="$background" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 } as any}>
                    <PendingTokenLayout
                        token={token}
                        amount={entry.amount}
                        fee={mintFee}
                        mintUrl={entry.mintUrl}
                        lockedToNpub={lockedToNpub}
                        onClaim={entry.type === 'receive' ? handleClaimNow : undefined}
                        isClaiming={isClaiming}
                    />

                    <AppBottomSheet ref={deleteSheetRef}>
                        <YStack p="$4" gap="$5">
                            <YStack gap="$2" items="center">
                                <View p="$4" bg="$red2" rounded="$10">
                                    <Trash2 size={32} color="$red10" />
                                </View>
                                <Text fontSize="$6" fontWeight="800">Delete Record?</Text>
                                <Text color="$gray10" text="center" px="$4">
                                    This will remove this transaction from your local history. It cannot be undone.
                                </Text>
                            </YStack>

                            <YStack gap="$3">
                                <Button
                                    theme="red"
                                    size="$5"
                                    fontWeight="800"
                                    onPress={handleDelete}
                                >
                                    Confirm Delete
                                </Button>
                                <Button
                                    chromeless
                                    size="$5"
                                    fontWeight="800"
                                    onPress={() => deleteSheetRef.current?.dismiss()}
                                >
                                    Cancel
                                </Button>
                            </YStack>
                        </YStack>
                    </AppBottomSheet>
                </ScrollView>
            </>
        );
    }

    try {
        return (
            <>
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <XStack gap="$2">
                                <Button
                                    circular
                                    size="$3"
                                    icon={isRefetching ? <Spinner /> : <RefreshCw size={22} color="$color" />}
                                    chromeless
                                    onPress={handleRefresh}
                                    disabled={isRefetching}
                                />
                                <Button
                                    circular
                                    size="$3"
                                    icon={<Trash2 size={20} color="$red10" />}
                                    chromeless
                                    onPress={() => deleteSheetRef.current?.present()}
                                />
                            </XStack>
                        ),
                    }}
                />
                <ScrollView p="$4" pb="$8" bg="$background" showsVerticalScrollIndicator={false}>
                    <YStack bg="$background" p="$4" mx="$-4" mt="$-4" pt="$4">
                        {/* Amount Display */}
                        <YStack gap="$1" mb="$6" >
                            <Circle size={40} bg={amountColor} opacity={1} mr="$3" items="center" justify="center">
                                {isOutgoing ? <ArrowUpRight size={20} color="white" /> : <ArrowDownLeft size={20} color="white" />}
                            </Circle>
                            <Text fontSize="$9" fontWeight="800" color={amountColor}>
                                {amountSign}₿{entry.amount?.toLocaleString() ?? '0'}
                            </Text>
                            <Text fontSize="$5" color="$gray10" >
                                {currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)}
                            </Text>
                        </YStack>

                        {/* Timeline / Status Card */}
                        <YStack bg="$gray2" rounded="$4" p="$4" mb="$6">
                            <XStack
                                justify="space-between"
                                items="center"
                                pressStyle={{ opacity: 0.7 }}
                                onPress={() => setIsStatusExpanded(!isStatusExpanded)}
                            >
                                <YStack>
                                    <Text fontSize="$4" color="$gray10" fontWeight="700" mb="$0" textTransform='uppercase' letterSpacing={1}>
                                        STATUS
                                    </Text>
                                </YStack>
                                <XStack items="center" gap="$2">
                                    <Text fontSize="$5" fontWeight="800" color={statusConfig.color as any}>
                                        {formattedStatus.toUpperCase()}
                                    </Text>
                                    {status === 'pending' && (
                                        <View bg="$orange3" px="$2" py="$1" rounded="$2">
                                            <Text fontSize="$1" fontWeight="800" color="$orange10">ACTION REQUIRED</Text>
                                        </View>
                                    )}
                                    {isStatusExpanded ? <ChevronUp size={20} color="$gray10" /> : <ChevronDown size={20} color="$gray10" />}
                                </XStack>
                            </XStack>

                            {isStatusExpanded && (
                                <YStack mt="$4" pt="$4" borderTopWidth={1} borderColor="$borderColor">
                                    {/* Step 1: Prepared */}
                                    <XStack gap="$3">
                                        <YStack items="center">
                                            <Circle size={24} bg="$green10">
                                                <Check size={14} color="black" />
                                            </Circle>
                                            <View width={2} flex={1} bg={status === 'completed' || status === 'claimed' ? "$green10" : "$gray8"} my="$1" />
                                        </YStack>
                                        <YStack pb="$4">
                                            <Text fontSize="$4" fontWeight="700" color="$color">Prepared</Text>
                                            <Text fontSize="$3" color="$gray10">{formatFullLocalTime(entry.createdAt)}</Text>
                                        </YStack>
                                    </XStack>

                                    {/* Step 2: Current Status */}
                                    <XStack gap="$3">
                                        <Circle size={24} bg={statusConfig.color as any} items="center" justify="center">
                                            <statusConfig.icon size={14} color={status === 'completed' || status === 'claimed' ? "black" : "$color"} />
                                        </Circle>
                                        <YStack>
                                            <Text fontSize="$4" fontWeight="700" color="$color">{formattedStatus}</Text>
                                            <Text fontSize="$3" color="$gray10">
                                                {status === 'pending' ? 'Waiting for recipient...' :
                                                    status === 'claimed' ? 'Tokens claimed by recipient' :
                                                        status === 'completed' ? 'Transaction completed' :
                                                            'Funds processed successfully'}
                                            </Text>
                                        </YStack>
                                    </XStack>
                                </YStack>
                            )}
                        </YStack>

                        <YStack gap="$0" mb="$6" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                            <DetailItem label="Amount" value={`${entry.amount || 0} ${entry.unit || 'sats'}`} />
                            <DetailItem label="Date" value={formatFullLocalTime(entry.createdAt)} />
                            <DetailItem label="Type" value={`${title} • ${entry.type === 'send' ? 'Outgoing' : 'Incoming'}`} />
                            <DetailItem label="Status" value={formattedStatus} />
                            {lockedToNpub && (
                                <DetailItem
                                    label="Locked To"
                                    value={lockedToNpub === useSettingsStore.getState().npub ? "You (Safe)" : `${lockedToNpub.substring(0, 10)}...${lockedToNpub.substring(lockedToNpub.length - 6)}`}
                                    isCopyable={lockedToNpub !== useSettingsStore.getState().npub}
                                    onCopy={async () => {
                                        await Clipboard.setStringAsync(lockedToNpub);
                                        Haptics.selectionAsync();
                                        toast.show('Copied!', { message: 'NPUB copied to clipboard' });
                                    }}
                                />
                            )}
                            <DetailItem label="Token" value={token && typeof token === 'string' ? `${token.substring(0, 10)}...${token.substring(token.length - 6)}` : 'N/A'} isCopyable copyValue={token} onCopy={handleCopyToken} />
                            <DetailItem label="Mint" value={(entry.mintUrl || 'Unknown').replace(/^https?:\/\//, '').split('/')[0]} />
                            {mintFee > 0 && (
                                <DetailItem label="Fee Rate" value={`${mintFee} ppk (${(mintFee / 10).toFixed(1)}%)`} />
                            )}
                        </YStack>
                    </YStack>


                    {token && typeof token === 'string' && (status === 'pending' || status === 'unclaimed') && (
                        <YStack gap="$4" pb="$4" mt="$4">
                            {entry.type === 'send' ? (
                                <PendingTokenLayout
                                    token={token}
                                    amount={entry.amount}
                                    fee={mintFee}
                                    mintUrl={entry.mintUrl}
                                    lockedToNpub={lockedToNpub}
                                    hideDetails={true}
                                />
                            ) : entry.type === 'receive' && status === 'unclaimed' ? (
                                <YStack gap="$2">
                                    <Button
                                        bg="$green10"
                                        color="white"
                                        size="$5"
                                        height={55}
                                        rounded="$4"
                                        onPress={handleClaimNow}
                                        disabled={isClaiming}
                                        icon={isClaiming ? <Spinner size="small" color="white" /> : <ArrowDownLeft size={20} color="white" />}
                                    >
                                        CLAIM NOW
                                    </Button>
                                </YStack>
                            ) : null}

                            <XStack gap="$2" px={entry.type === 'receive' ? "$0" : "$0"}>
                                <Button flex={1} bg="$gray3" color="$color" height={55} icon={<Copy size={18} />} onPress={handleCopyToken} fontWeight="800">Copy</Button>
                                <Button flex={1} bg="$gray3" color="$color" height={55} icon={<Share2 size={18} />} onPress={handleShare} fontWeight="800">Share</Button>
                            </XStack>
                        </YStack>
                    )}

                    {token && typeof token === 'string' && (status === 'claimed' || status === 'completed') && (
                        <YStack gap="$4" pb="$4" mt="$4">
                            <Button bg="$gray3" color="$color" icon={<Copy size={18} />} onPress={handleCopyToken} fontWeight="800">Copy Token</Button>
                        </YStack>
                    )}

                    {/* Danger Zone */}
                    <YStack gap="$3" mt="$10" pb="$10" borderTopWidth={1} borderColor="$gray4" pt="$6">
                        <XStack items="center" gap="$2">
                            <AlertCircle size={14} color="$red9" />
                            <Text fontSize="$2" fontWeight="800" color="$gray10" textTransform="uppercase" letterSpacing={1}>Danger Zone</Text>
                        </XStack>
                        <Button
                            theme="red"
                            variant="outlined"
                            size="$5"
                            fontWeight="800"
                            icon={<Trash2 size={20} color="$red10" />}
                            onPress={() => deleteSheetRef.current?.present()}
                        >
                            Delete Transaction History
                        </Button>
                    </YStack>

                    <AppBottomSheet ref={deleteSheetRef}>
                        <YStack p="$4" gap="$5">
                            <YStack gap="$2" items="center">
                                <View p="$4" bg="$red2" rounded="$10">
                                    <Trash2 size={32} color="$red10" />
                                </View>
                                <Text fontSize="$6" fontWeight="800">Delete Record?</Text>
                                <Text color="$gray10" text="center" px="$4">
                                    This will remove this transaction from your local history. It cannot be undone.
                                </Text>
                            </YStack>

                            <YStack gap="$3">
                                <Button
                                    theme="red"
                                    size="$5"
                                    fontWeight="800"
                                    onPress={handleDelete}
                                >
                                    Confirm Delete
                                </Button>
                                <Button
                                    chromeless
                                    size="$5"
                                    fontWeight="800"
                                    onPress={() => deleteSheetRef.current?.dismiss()}
                                >
                                    Cancel
                                </Button>
                            </YStack>
                        </YStack>
                    </AppBottomSheet>
                </ScrollView>
            </>
        );
    } catch (e: any) {
        console.error('[TransactionDetails] Error during render:', e);
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '$background' }}>
                <YStack flex={1} items="center" justify="center" p="$6" gap="$4">
                    <AlertCircle size={48} color="$red10" />
                    <Text fontSize="$6" fontWeight="800">Render Error</Text>
                    <Text color="$gray10" text="center">{e.message}</Text>
                    <Button mt="$4" onPress={() => router.back()}>Go Back</Button>
                </YStack>
            </SafeAreaView>
        );
    }
}

function DetailItem({ label, value, isCopyable, copyValue, onCopy }: { label: string, value: string, isCopyable?: boolean, copyValue?: string, onCopy?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$4" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$5" text="right" fontWeight="800" color="$color" numberOfLines={2} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}
