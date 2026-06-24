import React, { useState, useMemo, useEffect, useRef } from 'react';
import { YStack, XStack, Text, Button, ScrollView, View, Separator, Circle, Popover, ListItem, Adapt, Sheet, Square } from 'tamagui';
import { ChevronLeft, RefreshCw, Copy, Share2, ArrowUpRight, ArrowDownLeft, Calendar, Coins, Zap, ShieldCheck, ExternalLink, AlertCircle, CheckCircle2, Check, RotateCcw, MoreHorizontal, Link, Contact2, Scan, Gauge, ZoomIn, Hexagon, History, X, Ban, CheckCircle, ChevronDown, ChevronUp, Menu } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Share as RNShare } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { Buffer } from 'buffer';
import { formatFullLocalTime, formatRelativeTime } from '~/utils/time';
import { historyService, initService, proofService, cleanToken, decodeToken, encodeToken, encodePeanut, encodeTokenV4, encodeTokenV3, walletService, mintManager, quotesService } from '~/services/core';
import { nip19 } from 'nostr-tools';
import { PendingTokenLayout } from '~/components/UI/PendingTokenLayout';
import { PendingMintInvoiceLayout } from './components/PendingMintInvoiceLayout';
import { CompletedMintDetailsTable } from './components/CompletedMintDetailsTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '~/store/settingsStore';
import { sqliteStorage } from '~/store/sqliteStorage';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner } from '~/components/UI/Spinner';
import { useToastController } from '@tamagui/toast';
import { notificationService } from '~/services/notificationService';
import amount from 'temp/Sovran/app/(receive-flow)/amount';

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
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();

    const { data: entry, refetch, isRefetching } = useQuery({
        queryKey: ['transaction', id],
        queryFn: async () => {
            if (!id) return null;
            // 1. Try to load from historyRepository by ID (autoincrement ID)
            try {
                const repo = initService.getRepo();
                if (repo?.historyRepository) {
                    const dbEntry = await (repo.historyRepository as any).getHistoryEntryById(id);
                    if (dbEntry) {
                        console.log('[TransactionDetails] Loaded entry directly by ID from historyRepository:', dbEntry);
                        return dbEntry as HistoryEntry;
                    }
                }
            } catch (err) {
                console.warn('[TransactionDetails] Failed to load by ID from historyRepository:', err);
            }

            // 2. If it's a quoteId, try to find by quoteId or matching ID in repository entries
            try {
                const repo = initService.getRepo();
                if (repo?.historyRepository && typeof id === 'string') {
                    const history = await (repo.historyRepository as any).getPaginatedHistoryEntries(200, 0);
                    const dbEntry = history.find((e: any) => e.id === id || e.quoteId === id);
                    if (dbEntry) {
                        console.log('[TransactionDetails] Found entry by quoteId/id in paginated historyRepository entries:', dbEntry);
                        return dbEntry as HistoryEntry;
                    }
                }
            } catch (err) {
                console.warn('[TransactionDetails] Failed to load by quoteId from historyRepository:', err);
            }

            // 3. Fallback to core historyService
            console.log('[TransactionDetails] Falling back to core historyService search for id:', id);
            const history = await historyService.getHistory(200, 0);
            return (history.find((e: any) => e.id === id) as HistoryEntry) || null;
        },
        enabled: !!id,
    });

    // Fetch corresponding mint quote from DB to get the actual expiry
    const { data: mintQuote, refetch: refetchMintQuote } = useQuery({
        queryKey: ['mintQuote', entry?.mintUrl, (entry as any)?.quoteId],
        queryFn: async () => {
            if (!entry || entry.type !== 'mint' || !(entry as any).quoteId) return null;
            try {
                const repo = initService.getRepo();
                if (repo?.mintQuoteRepository) {
                    const quote = await repo.mintQuoteRepository.getMintQuote(entry.mintUrl, (entry as any).quoteId);
                    console.log('[TransactionDetails] Loaded mintQuote from repository:', quote);
                    return quote;
                }
            } catch (err) {
                console.warn('[TransactionDetails] Failed to load mint quote from repository:', err);
            }
            return null;
        },
        enabled: !!entry && entry.type === 'mint' && !!(entry as any).quoteId,
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
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const isQuoteExpired = useMemo(() => {
        if (!mintQuote?.expiry) return false;
        return mintQuote.expiry < Date.now() / 1000;
    }, [mintQuote?.expiry]);

    useEffect(() => {
        if (!mintQuote?.expiry) {
            setTimeLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = mintQuote.expiry - now;
            return remaining > 0 ? remaining : 0;
        };

        setTimeLeft(calculateTimeLeft());

        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timer);
                // Mark in DB as failed if it is still UNPAID/pending in history
                const repo = initService.getRepo();
                if (repo?.historyRepository && entry && (entry.state === 'UNPAID' || entry.state === 'PAID')) {
                    (repo.historyRepository as any).updateHistoryMintEntry(entry.mintUrl, (entry as any).quoteId, 'failed')
                        .then(() => {
                            console.log('[TransactionDetails] Marked expired quote as failed in database');
                            refetch();
                            refetchMintQuote();
                            queryClient.invalidateQueries({ queryKey: ['history'] });
                        })
                        .catch(e => console.warn('[TransactionDetails] Failed to update expired quote in DB:', e));
                } else {
                    refetch();
                    refetchMintQuote();
                    queryClient.invalidateQueries({ queryKey: ['history'] });
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [mintQuote?.expiry, entry?.id]);
    const [isStatusExpanded, setIsStatusExpanded] = useState(false);
    const [isReclaiming, setIsReclaiming] = useState(false);
    const [isCheckingPaid, setIsCheckingPaid] = useState(false);

    const status = entry?.state || 'completed';

    const isPendingMint = useMemo(() => {
        if (!entry) return false;
        const s = (entry.state || '').toUpperCase();
        return entry.type === 'mint' && (s === 'UNPAID' || s === 'PAID');
    }, [entry]);

    const isPendingSend = useMemo(() => {
        if (!entry) return false;
        const s = (entry.state || '').toUpperCase();
        return entry.type === 'send' && (s === 'PENDING' || s === 'UNCLAIMED');
    }, [entry]);

    const metadata = useMemo(() => {
        if (!entry?.metadata) return {};
        if (typeof entry.metadata === 'string') {
            try {
                return JSON.parse(entry.metadata);
            } catch (e) {
                return {};
            }
        }
        return entry.metadata;
    }, [entry?.metadata]);

    const expiresAt = metadata?.expiresAt ? Number(metadata.expiresAt) : undefined;

    const handleReclaim = async () => {
        if (!token || isReclaiming) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsReclaiming(true);
        try {
            await walletService.receive(token.trim());
            toast.show('Refunded!', { message: 'Funds reclaimed to your wallet' });

            // Update state in DB
            const repo = initService.getRepo();
            if (repo?.historyRepository) {
                await (repo.historyRepository as any).updateHistoryEntryState(entry.id, 'expired');
            }

            // Delete local inflight proofs if any
            try {
                const clean = cleanToken(token);
                const decoded = decodeToken(clean);
                const secrets = decoded.proofs.map((p: any) => p.secret);
                if (secrets.length > 0) {
                    await repo.proofRepository.deleteProofs(entry.mintUrl, secrets);
                }
            } catch (e) {
                console.warn('[TransactionDetails] Failed to delete inflight proofs during reclaim:', e);
            }

            // Refresh UI
            setTimeout(() => {
                handleRefresh();
            }, 500);
        } catch (err: any) {
            console.error('[TransactionDetails] Reclaim failed:', err);
            toast.show('Reclaim Failed', { message: err.message });
        } finally {
            setIsReclaiming(false);
        }
    };

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

    // Check for saved invoice for pending mints
    const [savedInvoice, setSavedInvoice] = useState<string | null>(null);
    useEffect(() => {
        if (isPendingMint) {
            try {
                if ((entry as any).paymentRequest) {
                    setSavedInvoice((entry as any).paymentRequest);
                    return;
                }
                const cached = sqliteStorage.getItem('mint_invoices');
                if (cached) {
                    const invoices = JSON.parse(cached);
                    const data = invoices[entry.id];
                    if (data && data.expiry > Date.now()) {
                        setSavedInvoice(data.pr);
                    }
                }
            } catch (e) {
                console.error('[TransactionDetails] Failed to read saved invoice:', e);
            }
        }
    }, [entry, isPendingMint]);

    // Animated QR states
    const [qrCodeFragment, setQrCodeFragment] = useState<string>('');
    // UR animated QR is opt-in — standard wallets (Minibits, cashu.me, Sovan) expect plain cashu: QR
    const [showAnimatedQR, setShowAnimatedQR] = useState(false);
    const [fragmentLength, setFragmentLength] = useState(150); // L=150, M=100, S=50
    const [intervalMs, setIntervalMs] = useState(140); // F=140, M=250, S=500
    const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>('V4');
    const encoderRef = useRef<UREncoder | null>(null);

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
        if (status === 'claimed' || status === 'completed' || entry?.type === 'receive') {
            return { color: '$green11', bg: '$green3', headerBg: '$green9', icon: CheckCircle2, label: 'Success' };
        }
        if (status === 'pending' || status === 'unclaimed') {
            const isExpired = expiresAt && Date.now() > expiresAt;
            if (isExpired) {
                return { color: '$red10', bg: '$red3', headerBg: '$red9', icon: Ban, label: 'Expired' };
            }
            return { color: '$orange10', bg: '$orange3', headerBg: '$orange9', icon: RefreshCw, label: 'Pending' };
        }
        if (status === 'expired' || status === 'refunded') {
            return { color: '$red10', bg: '$red3', headerBg: '$red9', icon: Ban, label: 'Expired & Refunded' };
        }
        if (status === 'failed' || status === 'error') {
            return { color: '$red10', bg: '$red3', headerBg: '$red9', icon: AlertCircle, label: 'Failed' };
        }
        return { color: '$gray10', bg: '$gray3', headerBg: '$gray9', icon: AlertCircle, label: status };
    }, [status, entry?.type, expiresAt]);

    const title = useMemo(() => {
        const type = entry?.type;
        const meta = entry?.metadata ?? {};
        const via = typeof meta === 'string' ? (() => { try { return JSON.parse(meta).via; } catch { return undefined; } })() : meta?.via;

        if (!type || typeof type !== 'string') return 'Transaction';
        switch (type.toLowerCase()) {
            case 'send':
                if (via === 'nostr') return 'Sent via Nostr';
                if (via === 'ecash_create') return 'Created Ecash Token';
                return 'Sent Ecash';
            case 'receive':
                if (via === 'nostr') return 'Received via Nostr';
                if (via === 'qr' || via === 'scan') return 'Received via QR';
                if (via === 'nfc') return 'Received via NFC';
                return 'Received Ecash';
            case 'mint': return 'Lightning → Ecash';
            case 'melt': return 'Ecash → Lightning';
            default: return 'Transaction';
        }
    }, [entry?.type, entry?.metadata]);


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


        if (token) {
            try {
                const states = await proofService.checkProofStates(token);
                const isSpent = states.some((s: any) => s.state === 'SPENT');
                const isPending = states.some((s: any) => s.state === 'PENDING');

                let newState = entry?.state;
                if (isSpent) newState = 'claimed';
                else if (isPending) newState = 'pending';
                else newState = 'unclaimed';

                // If pending and unspent but expired, trigger auto-sweep/refund
                if (!isSpent && expiresAt && Date.now() > expiresAt && newState !== 'claimed') {
                    console.log('[TransactionDetails] Token expired and unspent on refresh. Sweeping...');
                    await walletService.receive(token.trim());
                    newState = 'expired';
                    try {
                        const clean = cleanToken(token);
                        const decoded = decodeToken(clean);
                        const secrets = decoded.proofs.map((p: any) => p.secret);
                        if (secrets.length > 0) {
                            const repo = initService.getRepo();
                            await repo.proofRepository.deleteProofs(entry.mintUrl, secrets);
                        }
                    } catch (e) {}
                }

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

    // Auto-refresh on mount and poll if pending — first check is immediate, then every 3s
    useEffect(() => {
        if (!entry || !initService.isInitialized()) return;

        const isPendingSend = entry.type === 'send' && (status === 'pending' || status === 'unclaimed');
        const isPendingMint = entry.type === 'mint' && (status.toUpperCase() === 'UNPAID' || status.toUpperCase() === 'PAID');

        if (!isPendingSend && !isPendingMint) return;

        const poll = async () => {
            if (isPendingSend) {
                await handleRefresh();
            } else if (isPendingMint) {
                try {
                    const qId = (entry as any).quoteId || '';
                    if (qId && entry.mintUrl) {
                        await quotesService.redeemMintQuote(entry.mintUrl, qId);
                        console.log('[TransactionDetails] Background redeem success for mint quote:', qId);
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                        refetch();
                    }
                } catch (e) {
                    // Not paid yet — normal in background polling
                }
            }
        };

        // Fire immediately
        poll();
        const interval = setInterval(poll, 3000);

        return () => clearInterval(interval);
    }, [entry?.id, entry?.state, status]);
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


    const isOutgoing = entry.type === 'send' || entry.type === 'melt';
    const amountColor = isOutgoing ? '$red10' : '$green11';
    const amountSign = isOutgoing ? '-' : '+';

    const showInvoiceLayout = useMemo(() => {
        if (!savedInvoice) return false;
        if (status.toUpperCase() !== 'UNPAID' && status.toUpperCase() !== 'PAID') return false;
        return !isQuoteExpired;
    }, [savedInvoice, status, isQuoteExpired]);

    if (showInvoiceLayout && savedInvoice) {
        return (
            <>
                <Stack.Screen
                    options={{
                        headerTitleAlign: 'center',
                        headerTitle: () => (
                            <XStack>
                                <Text fontWeight="700" fontSize={20} color="$color">Pending Deposit</Text>
                            </XStack>
                        ),
                        headerRight: () => (
                            <XStack p="$1" gap="$3" items="center" justify="center">
                                <Button
                                    circular
                                    size="$3"
                                    icon={isRefetching ? <Spinner /> : <RefreshCw size={22} color="$color" />}
                                    chromeless
                                    onPress={handleRefresh}
                                    disabled={isRefetching}
                                />
                            </XStack>
                        ),
                    }}
                />
                <PendingMintInvoiceLayout
                    savedInvoice={savedInvoice}
                    timeLeft={timeLeft}
                    entry={entry as any}
                    formattedStatus={formattedStatus}
                    primaryCurrency={primaryCurrency}
                    secondaryCurrency={secondaryCurrency}
                    fiatAmount={fiatAmount}
                    isCheckingPaid={isCheckingPaid}
                    onCancel={async () => {
                        try {
                            const repo = initService.getRepo();
                            if (repo?.historyRepository) {
                                await (repo.historyRepository as any).updateHistoryMintEntry(entry.mintUrl, (entry as any).quoteId, 'failed');
                                toast.show('Cancelled', { message: 'Deposit invoice marked as failed.' });
                                await handleRefresh();
                            }
                        } catch (e) {
                            console.warn('[TransactionDetails] Failed to cancel quote:', e);
                        }
                    }}
                    onPaid={async () => {
                        setIsCheckingPaid(true);
                        try {
                            await quotesService.redeemMintQuote(entry.mintUrl, (entry as any).quoteId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            toast.show('Paid!', { message: 'Ecash claimed successfully.' });
                            await handleRefresh();
                        } catch (err: any) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            toast.show('Not Paid Yet', { message: 'The invoice has not been paid yet. Please wait or try again.' });
                        } finally {
                            setIsCheckingPaid(false);
                        }
                    }}
                />
            </>
        );
    }

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
                                    icon={isRefetching ? <Spinner size={22} /> : <RefreshCw size={22} color="$color" />}
                                    chromeless
                                    onPress={handleRefresh}
                                    disabled={isRefetching}
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
                        onReclaim={entry.type === 'send' ? handleReclaim : undefined}
                        isReclaiming={isReclaiming}
                        expiresAt={expiresAt}
                    />

                </ScrollView>
            </>
        );
    }

    try {
        return (
            <>
                <Stack.Screen
                    options={{
                        headerTitleAlign: 'center',
                        headerTitle: () => (
                            <XStack>
                                <Text fontWeight="700" fontSize={20} color="$color">Details</Text>
                            </XStack>
                        ),
                        headerRight: () => (
                            <XStack p="$1" gap="$3" items="center" justify="center">


                                <Button
                                    circular
                                    size="$3"
                                    icon={isRefetching ? <Spinner /> : <RefreshCw size={22} color="$color" />}
                                    chromeless
                                    onPress={handleRefresh}
                                    disabled={isRefetching}
                                />
                            </XStack>
                        ),
                    }}
                />
                <ScrollView gap="$3" pb="$8" p="$4" bg="$background" showsVerticalScrollIndicator={false}>
                    <YStack bg="$background" gap="$3" >
                        {/* SuccessStage-like Amount Display */}
                        <YStack width="100%" justify="space-between" height={260} bg="$gray2" rounded="$5" items="center" gap="$3" >
                            <Text width="100%" p="$3" text="center" borderBottomWidth={1} borderColor="$borderColor" fontWeight="800" fontSize="$5" color={status === 'failed' || status === 'error' || status === 'expired' || status === 'refunded' ? '$red10' : status === 'pending' || status === 'unclaimed' ? '$orange10' : '$color'}>
                                {status === 'failed' || status === 'error' ? 'Transaction Failed' :
                                    status === 'expired' || status === 'refunded' ? 'Transaction Expired' :
                                    status === 'pending' || status === 'unclaimed' ? 'Transaction Pending' :
                                        entry.type === 'send' ? 'Sent Successfully!' :
                                            entry.type === 'receive' ? 'Received Successfully!' :
                                                entry.type === 'mint' ? 'Minted Successfully!' :
                                                    entry.type === 'melt' ? 'Invoice Paid!' : 'Transaction Completed!'}
                            </Text>
                            <YStack items="center" justify="center">
                                {primaryCurrency === 'SATS' ? (
                                    <>
                                        <Text fontSize="$9" fontWeight="900" color={isOutgoing ? '$red10' : '$green11'}>
                                            {amountSign}₿{entry.amount?.toLocaleString() ?? '0'}
                                        </Text>
                                        <Text fontSize="$5" fontWeight="600" color="$gray10">
                                            {amountSign}{currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text fontSize="$9" fontWeight="900" color={isOutgoing ? '$red10' : '$green11'}>
                                            {amountSign}{currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)}
                                        </Text>
                                        <Text fontSize="$5" fontWeight="600" color="$gray10">
                                            {amountSign}₿{entry.amount?.toLocaleString() ?? '0'}
                                        </Text>
                                    </>
                                )}
                            </YStack>
                            <YStack items="center" width="100%" gap="$1" p="$3" borderTopWidth={1} borderColor="$borderColor">
                                <Text color="$gray10" fontSize="$4" text="center">
                                    {status === 'failed' || status === 'error' ? 'Funds were not transferred.' :
                                        status === 'expired' || status === 'refunded' ? 'Funds were returned to your wallet.' :
                                        status === 'pending' || status === 'unclaimed' ? 'Wait for payment to be processed.' :
                                            entry.type === 'send' ? 'The recipient has claimed your ecash.' :
                                                entry.type === 'receive' ? 'The ecash has been added to your wallet.' :
                                                    entry.type === 'mint' ? 'Ecash added to your wallet.' :
                                                        entry.type === 'melt' ? 'Lightning invoice was successfully paid.' : 'Transaction processed.'}
                                </Text>
                            </YStack>
                        </YStack>

                        {/* Details table */}
                        {entry.type === 'mint' ? (
                            <CompletedMintDetailsTable
                                entry={entry}
                                formattedStatus={formattedStatus}
                                primaryCurrency={primaryCurrency}
                                secondaryCurrency={secondaryCurrency}
                                fiatAmount={fiatAmount}
                                title={title}
                                savedInvoice={savedInvoice}
                            />
                        ) : (
                            <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                {primaryCurrency === 'FIAT' ? (
                                    <>
                                        <DetailItem label="Amount" value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)} />
                                        <DetailItem label="Sats" value={`${entry.amount || 0} sats`} />
                                    </>
                                ) : (
                                    <>
                                        <DetailItem label="Amount" value={`${entry.amount || 0} sats`} />
                                        <DetailItem label="Fiat" value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)} />
                                    </>
                                )}
                                <DetailItem label="Date" value={formatFullLocalTime(entry.createdAt)} />
                                <DetailItem label="Type" value={title} />
                                <DetailItem label="Status" value={formattedStatus} />
                                {/* Via channel */}
                                {(() => {
                                    let meta = entry.metadata ?? {};
                                    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
                                    const via: string | undefined = (meta as any)?.via;
                                    const nostrUsername: string | undefined = (meta as any)?.nostrUsername;
                                    const nostrPubkey: string | undefined = (meta as any)?.nostrPubkey;
                                    if (!via) return null;
                                    const viaLabel = via === 'nostr' ? 'Nostr'
                                        : via === 'qr' || via === 'scan' ? 'QR Scan'
                                        : via === 'nfc' ? 'NFC'
                                        : via === 'ecash_create' ? 'Ecash Token'
                                        : via === 'paste' ? 'Paste'
                                        : via === 'lightning' ? 'Lightning'
                                        : via;
                                    return (
                                        <>
                                            <DetailItem label="Channel" value={viaLabel} />
                                            {via === 'nostr' && (nostrUsername || nostrPubkey) && (
                                                <DetailItem
                                                    label={entry.type === 'send' ? 'Recipient' : 'Sender'}
                                                    value={nostrUsername
                                                        ? `@${nostrUsername.replace('@bey.cash', '')}`
                                                        : nostrPubkey
                                                        ? `${nostrPubkey.slice(0, 12)}…${nostrPubkey.slice(-6)}`
                                                        : 'Unknown'}
                                                    isCopyable={!!nostrPubkey}
                                                    copyValue={nostrPubkey}
                                                    onCopy={async () => {
                                                        if (nostrPubkey) {
                                                            await Clipboard.setStringAsync(nostrPubkey);
                                                            toast.show('Copied!', { message: 'Nostr pubkey copied' });
                                                        }
                                                    }}
                                                />
                                            )}
                                        </>
                                    );
                                })()}
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
                        )}
                    </YStack>


                    {token && typeof token === 'string' && (status === 'pending' || status === 'unclaimed') && (
                        <YStack gap="$3" mt="$3" pb="$4" >
                            {entry.type === 'send' ? (
                                <PendingTokenLayout
                                    token={token}
                                    amount={entry.amount}
                                    fee={mintFee}
                                    mintUrl={entry.mintUrl}
                                    lockedToNpub={lockedToNpub}
                                    hideDetails={true}
                                    onReclaim={handleReclaim}
                                    isReclaiming={isReclaiming}
                                    expiresAt={expiresAt}
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
                        <YStack gap="$3" mt="$3" pb="$4" >
                            <Button bg="$gray3" color="$color" icon={<Copy size={18} />} onPress={handleCopyToken} fontWeight="800">Copy Token</Button>
                        </YStack>
                    )}

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
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$3" text="right" fontWeight="800" color="$color" numberOfLines={2} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}

