import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Buffer } from 'buffer';
import {
    YStack,
    XStack,
    Text,
    H1,
    Button,
    Separator,
    ScrollView,
    View,
    Input,
    Avatar,
    Square,
} from 'tamagui';
import { DeviceEventEmitter } from 'react-native';
import {
    QrCode,
    Copy,
    Share2,
    Check,
    RefreshCw,
    Building2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Zap,
    Sprout,
    ArrowUpDown,
    Globe,
    PenLine,
    X as XIcon,
} from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import { NumericKeypad } from '../../components/UI/NumericKeypad';
import { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';
import { MintSelectorSheet } from '../../components/HomeMintSelector';
import Blockies from '../../components/UI/Blockies';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { useToastController } from '@tamagui/toast';
import QRCode from 'react-native-qrcode-svg';
import { useWalletStore } from '../../store/walletStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useNostrRequestStore } from '../../store/nostrRequestStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '../../services/currencyService';
import { walletService, historyService } from '../../services/core';
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';
import { decode as nip19Decode, nprofileEncode } from 'nostr-tools/nip19';
import { ResultStage } from '../SendModalScreen/ResultStage';
import { sendNostrToken } from '../../services/core/nostrService';
import { seedService } from '../../services/seedService';
import { ProcessingSheet } from '../../components/UI/ProcessingSheet';
import { MintBalanceRow } from '~/components/UI/MintBalanceRow';
import { BouncyAmount } from '~/components/UI/BouncyAmount';

/** Simple unique ID — avoids a uuid dependency */
const makeRequestId = () =>
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'amount' | 'result' | 'success';

interface RequestEcashStageProps {
    onClose?: () => void;
    initialRequestId?: string;
    targetNpub?: string;
    targetUsername?: string;
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailItem({
    label,
    value,
    isCopyable,
    onCopy,
    onShare,
}: {
    label: string;
    value: string;
    isCopyable?: boolean;
    onCopy?: () => void;
    onShare?: () => void;
}) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$4" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$4" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 180 }}>
                    {value}
                </Text>
                {onShare && (
                    <Button size="$2" chromeless icon={<Share2 size={16} color="$gray10" />} onPress={onShare} />
                )}
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RequestEcashStage({ onClose, initialRequestId, targetNpub, targetUsername }: RequestEcashStageProps) {
    const router = useRouter();
    const [step, setStep] = useState<RequestStep>('amount');
    const [amount, setAmount] = useState('0');
    const [localInputValue, setLocalInputValue] = useState('0');
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(() => useSettingsStore.getState().primaryCurrency);
    const [note, setNote] = useState('');



    // NUT-18 payment request
    const [creqString, setCreqString] = useState<string | null>(null);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishedLink, setPublishedLink] = useState<string | null>(null);

    const sheetRef = useRef<AppBottomSheetRef>(null);
    const toast = useToastController();

    const { activeMintUrl, mints, setActiveMint, refreshMintList, isInitializing, isRefreshing, balance } = useWalletStore();
    const { secondaryCurrency, npub, primaryCurrency, showBitcoinSymbol } = useSettingsStore();
    const { addRequest, pendingRequests, loadPendingRequests } = useNostrRequestStore();

    // ── Restore from History (initialRequestId) ───────────────────────────────
    React.useEffect(() => {
        if (initialRequestId) {
            // Wait for store to be loaded just in case
            loadPendingRequests().then(() => {
                const req = useNostrRequestStore.getState().pendingRequests.find(r => r.id === initialRequestId);
                if (req) {
                    console.log('[RequestEcashStage] Restored request from history:', initialRequestId);
                    setAmount(req.amount.toString());
                    setLocalInputValue(req.amount.toString());
                    setCreqString(req.creqString);
                    setCurrentRequestId(req.id);
                    if (req.mintUrl !== activeMintUrl) {
                        setActiveMint(req.mintUrl);
                    }
                    if (req.description) {
                        setNote(req.description);
                    }
                    setStep('result');
                }
            });
        }
    }, [initialRequestId]);

    const activeMint = React.useMemo(() => {
        if (!activeMintUrl) return null;
        const normalizeUrl = (url: string) => url.replace(/\/$/, "");
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
    }, [mints, activeMintUrl]);

    const displayName = React.useMemo(() => {
        if (!activeMintUrl) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, activeMintUrl]);

    const isLoadingMint = isInitializing || isRefreshing;

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
    const amtNum = parseInt(amount, 10) || 0;
    const isValidAmount = amtNum > 0 && !!activeMintUrl;

    // ── Conversion labels ─────────────────────────────────────────────────────
    const conversionLabel = React.useMemo(() => {
        if (!btcData?.price) return '~';
        if (inputMode === 'SATS') {
            const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
            return `${currencySymbol}${val.toFixed(2)}`;
        }
        return currencyService.formatSats(amtNum);
    }, [amtNum, btcData?.price, inputMode, currencySymbol]);

    const conversionValue = React.useMemo(() => {
        if (!btcData?.price) return '0';
        if (inputMode === 'SATS') {
            const sats = Number(amount) || 0;
            return currencyService.formatValue(
                currencyService.convertSatsToCurrency(sats, btcData.price),
                secondaryCurrency as CurrencyCode
            );
        } else {
            return currencyService.formatSats(Number(amount) || 0);
        }
    }, [amount, btcData?.price, inputMode, secondaryCurrency]);

    const fiatValueLabel = React.useMemo(() => {
        if (!btcData?.price || !amtNum) return '—';
        const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
        return `${currencySymbol}${val.toFixed(2)}`;
    }, [amtNum, btcData?.price, currencySymbol]);

    const formattedDisplayValue = React.useMemo(() => {
        if (!localInputValue || localInputValue === '0') return '0';
        if (inputMode === 'SATS') {
            const num = Number(localInputValue);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US');
            }
        } else {
            const parts = localInputValue.split('.');
            const integerPart = Number(parts[0]);
            if (!isNaN(integerPart)) {
                const formattedInt = integerPart.toLocaleString('en-US');
                return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
            }
        }
        return localInputValue;
    }, [localInputValue, inputMode]);

    const dynamicFontSize = React.useMemo(() => {
        const len = formattedDisplayValue.length;
        if (len <= 6) return 44;
        if (len <= 8) return 38;
        if (len <= 10) return 32;
        if (len <= 13) return 26;
        return 20;
    }, [formattedDisplayValue]);

    const formatNpub = (str: string | null) => {
        if (!str) return '';
        if (str.length < 20) return str;
        return `${str.slice(0, 10)}...${str.slice(-6)}`;
    };

    // ── Keypad ────────────────────────────────────────────────────────────────
    const onKeypadChange = (rawVal: string) => {
        let val = rawVal;

        if (val === '.') {
            val = '0.';
        }

        if (inputMode === 'SATS') {
            val = val.replace(/\./g, '');
        } else {
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
            if (parts.length === 2 && parts[1].length > 2) {
                val = parts[0] + '.' + parts[1].slice(0, 2);
            }
        }

        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
            val = val.replace(/^0+/, '');
            if (val === '') val = '0';
        }

        const maxLen = 11;
        if (val.length > maxLen) {
            val = val.slice(0, maxLen);
        }

        setLocalInputValue(val);

        if (inputMode === 'SATS') {
            setAmount(val);
        } else if (btcData?.price) {
            const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
            setAmount(String(sats));
        }
    };

    const toggleMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (inputMode === 'SATS') {
            if (btcData?.price) {
                const fiat = currencyService.convertSatsToCurrency(Number(amount) || 0, btcData.price);
                setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
            }
            setInputMode('FIAT');
        } else {
            setLocalInputValue(amount);
            setInputMode('SATS');
        }
    };

    const handleMax = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const maxSats = balance.toString();
        setAmount(maxSats);
        if (inputMode === 'SATS') {
            setLocalInputValue(maxSats);
        } else if (btcData?.price) {
            const fiat = currencyService.convertSatsToCurrency(balance, btcData.price);
            setLocalInputValue(fiat.toFixed(2));
        }
    };

    // ── Mint selection ────────────────────────────────────────────────────────
    const handleSelectMint = (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
    };

    // ── Generate NUT-18 Cashu Payment Request ─────────────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!isValidAmount || !activeMintUrl) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsGenerating(true);
        setGenerateError(null);

        try {
            const reqId = makeRequestId();
            // NUT-18: PaymentRequest(transport, id, amount, unit, mints, description)
            let target = npub;
            if (npub && npub.startsWith('npub1')) {
                try {
                    const decoded = nip19Decode(npub);
                    if (decoded.type === 'npub') {
                        const hexPubkey = decoded.data as string;
                        // HACK: NUT-18 spec says target should be a hex pubkey. 
                        // However, cashu.me has a bug where it unconditionally calls `nip19.decode(target)` 
                        // and expects a `ProfilePointer` (which means it expects an `nprofile1...` string).
                        // Furthermore, if we omit relays, it decodes to `[]`, which breaks cashu.me's relay fallback.
                        // If we pass all 12 relays, the QR code becomes too dense to scan.
                        // We pass exactly ONE highly reliable relay to satisfy both constraints.
                        target = nprofileEncode({ pubkey: hexPubkey, relays: ['wss://relay.damus.io'] });
                    }
                } catch (e) {
                    console.warn('[RequestEcashStage] Failed to decode npub', e);
                }
            }

            const transports = npub ? [
                {
                    type: PaymentRequestTransportType.NOSTR,
                    target: target,
                    tags: [['n', '17']],
                }
            ] : [];

            const pr = new PaymentRequest(
                transports,
                reqId,
                amtNum,
                'sat',
                [activeMintUrl],
                note.trim() || undefined,
            );

            const encoded = pr.toEncodedRequest();

            if (targetNpub) {
                const mnemonic = await seedService.getMnemonic();
                if (!mnemonic) throw new Error('Wallet seed not found.');
                const keys = await seedService.getNostrKeys(mnemonic);
                const published = await sendNostrToken(encoded, targetNpub, keys.privkey);
                if (!published) {
                    throw new Error('Failed to send request via Nostr.');
                }
                console.log(`[RequestEcashStage] Sent request to ${targetNpub}`);
            }

            // ── Persist request to local DB so E-Cash screen shows it ──────────
            setCurrentRequestId(reqId);

            if (npub && activeMintUrl) {
                try {
                    await addRequest({
                        id: reqId,
                        mintUrl: activeMintUrl,
                        amount: amtNum,
                        unit: 'sat',
                        creqString: encoded,
                        nostrPubkey: npub,
                        description: note.trim() || undefined,
                    });
                    console.log('[RequestEcashStage] Request persisted to DB:', reqId);
                } catch (dbErr) {
                    console.warn('[RequestEcashStage] Could not persist request to DB:', dbErr);
                }
            }

            setCreqString(encoded);
            setStep('result');
        } catch (err: any) {
            console.error('[RequestEcashStage] PaymentRequest generation failed:', err);
            setGenerateError(err?.message || 'Failed to generate request');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsGenerating(false);
        }
    }, [amtNum, isValidAmount, activeMintUrl, note, npub, addRequest]);

    // ── Copy / Share ──────────────────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
        if (!creqString) return;
        await Clipboard.setStringAsync(creqString);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        toast.show('Copied!', { message: 'Payment request copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
    }, [creqString]);

    const handleShare = useCallback(async () => {
        if (!creqString) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Wallets like Minibits accept "cashu:" prefix for payment requests too
        await Share.share({ message: creqString });
    }, [creqString]);

    const handleReset = () => {
        setStep('amount');
        setCreqString(null);
        setGenerateError(null);
        setCopied(false);
        setPublishedLink(null);
    };

    const handlePublish = useCallback(async () => {
        if (!creqString) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsPublishing(true);
        try {
            // 1. Generate 32 bytes random secret_key
            const secretKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
            const secretKeyHex = Buffer.from(secretKeyBytes).toString('hex');

            // 2. Build Nostr event with the JSON payload including creq and note
            const { buildEcashNostrEvent } = require('../../utils/ecashSharing');
            const payload = JSON.stringify({ creq: creqString, note: note.trim() });
            const { event } = buildEcashNostrEvent(payload, secretKeyHex);

            // 3. Publish to relays
            const { SimplePool } = require('nostr-tools');
            const { RELAYS } = require('../../services/core/nostrService');
            const pool = new SimplePool();
            await Promise.any(pool.publish(RELAYS, event));
            pool.close(RELAYS);

            // 4. Construct share link
            const websiteUrl = 'https://bey.cash/r/';
            const shareLink = `${websiteUrl}#${secretKeyHex}`;
            setPublishedLink(shareLink);

            toast.show('Published!', { message: 'Request published on bey.cash' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            console.error('[RequestEcashStage] Failed to publish request:', err);
            toast.show('Publish Failed', { message: err?.message || 'Could not publish to relays' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsPublishing(false);
        }
    }, [creqString, note, toast]);

    // ── Real-Time Nostr Listener ──────────────────────────────────────────────
    React.useEffect(() => {
        if (step !== 'result') return;

        const subReceived = DeviceEventEmitter.addListener('nostr:received', (data: any) => {
            console.log('[RequestEcashStage] Received nostr:received event:', data);

            // Check if this payment matches our current request
            const isMatch = (data.requestId && data.requestId === currentRequestId) ||
                (data.amount === amtNum && data.mintUrl?.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, ''));

            if (isMatch) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Search history after a short delay to get the transaction ID and redirect
                setTimeout(async () => {
                    try {
                        const history = await historyService.getHistory(10, 0);
                        const entry = history.find(
                            (e: any) => e.type === 'receive' && Number(e.amount) === amtNum && e.mintUrl.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, '')
                        );
                        if (entry) {
                            onClose?.(); // Close the receive modal
                            router.push({
                                pathname: '/(modals)/txn-details',
                                params: { id: entry.id }
                            });
                        } else {
                            setStep('success');
                        }
                    } catch (err) {
                        console.warn('[RequestEcashStage] failed to check history for redirect:', err);
                        setStep('success');
                    }
                }, 800);
            }
        });

        return () => {
            subReceived.remove();
        };
    }, [step, currentRequestId, amtNum, activeMintUrl, onClose, router]);

    // ── Manual Check Status ───────────────────────────────────────────────────
    const handleCheckStatus = useCallback(async () => {
        setIsChecking(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Force nostrService to reconnect and fetch recent events
            const { nostrService } = require('../../services/core/nostrService');
            nostrService.refresh();

            // Wait 2.5 seconds for relay sync to complete
            await new Promise(r => setTimeout(r, 2500));

            await loadPendingRequests();
            const reqs = useNostrRequestStore.getState().pendingRequests;
            const stillPending = reqs.find(r => r.id === currentRequestId);

            if (!stillPending) {
                // It was removed from pending, meaning it was received!
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Search history to redirect to txn details
                try {
                    const history = await historyService.getHistory(10, 0);
                    const entry = history.find(
                        (e: any) => e.type === 'receive' && Number(e.amount) === amtNum && e.mintUrl.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, '')
                    );
                    if (entry) {
                        onClose?.(); // Close receive modal
                        router.push({
                            pathname: '/(modals)/txn-details',
                            params: { id: entry.id }
                        });
                        return;
                    }
                } catch (err) {
                    console.warn('[RequestEcashStage] check status redirect query error:', err);
                }
                setStep('success');
            } else {
                toast.show('Still Pending', { message: 'No payment received yet.' });
            }
        } catch (e) {
            console.warn('[RequestEcashStage] check status error:', e);
        } finally {
            setIsChecking(false);
        }
    }, [currentRequestId, loadPendingRequests, toast, amtNum, activeMintUrl, onClose, router]);

    // ────────────────────────────────────────────────────────────────────────
    // AMOUNT STAGE
    // ────────────────────────────────────────────────────────────────────────
    // AMOUNT STAGE
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'amount') {
        return (
            <YStack flex={1} px="$4" justify="space-between" bg="$background">
                <YStack gap="$1.5">
                    {/* Mint Selector Row */}
                 <MintBalanceRow
                    activeMint={activeMint}
                    activeMintUrl={activeMintUrl || undefined}
                    displayName={displayName}
                    balance={balance}
                    isLoadingMint={isLoadingMint}
                    isSelector={true}
                    onPress={() => {
                        refreshMintList();
                        sheetRef.current?.present();
                    }}
                    showMax={true}
                    onMaxPress={handleMax}
                    maxDisabled={balance === 0}
                />

                    {/* Card Box Container matching Send stages */}
                    <YStack
                        width="100%"
                        bg="$gray3"
                        rounded="$6"
                        p="$4"
                        py="$5"
                        items="center"
                        gap="$3"
                        borderWidth={0}
                    >
                        {/* Amount Display Section */}
                        <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
                            {generateError ? (
                                <YStack items="center" gap="$2" px="$4">
                                    <AlertCircle size={28} color="$red10" />
                                    <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                                        {generateError}
                                    </Text>
                                </YStack>
                            ) : !activeMintUrl ? (
                                <YStack items="center" gap="$2" px="$4">
                                    <AlertCircle size={28} color="$orange10" />
                                    <Text color="$orange10" fontSize="$3" fontWeight="600" textAlign="center">
                                        Select a mint to generate a request
                                    </Text>
                                </YStack>
                            ) : !npub ? (
                                <YStack items="center" gap="$2" px="$4">
                                    <AlertCircle size={28} color="$red10" />
                                    <Text color="$red10" fontSize="$3" fontWeight="600" textAlign="center">
                                        Nostr profile required to receive directly.
                                    </Text>
                                </YStack>
                            ) : (
                                <>
                                    {targetNpub ? (
                                        <XStack items="center" gap="$2" justify="center" flexWrap="wrap">
                                            <Text color="$gray10" fontSize="$3" fontWeight="500">
                                                Requesting from
                                            </Text>
                                            <XStack
                                                bg="$gray4"
                                                px="$2.5"
                                                py="$1"
                                                rounded="$10"
                                                items="center"
                                                gap="$1.5"
                                            >
                                                <Blockies seed={targetNpub} size={4} scale={2} style={{ borderRadius: 10 }} />
                                                <Text fontSize="$2" fontWeight="700" color="$gray12">
                                                    {targetUsername || formatNpub(targetNpub)}
                                                </Text>
                                            </XStack>
                                        </XStack>
                                    ) : (
                                        <Text color="$gray10" fontSize="$3" fontWeight="500">
                                            How much to request?
                                        </Text>
                                    )}

                                   
                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                        />
                                    <Button
                                        size="$3"
                                        rounded="$10"
                                        bg="$gray5"
                                        pressStyle={{ scale: 0.96, bg: "$gray5" }}
                                        onPress={toggleMode}
                                        iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
                                    >
                                        {conversionValue}
                                    </Button>
                                </>
                            )}
                    </YStack>

                    {/* Standalone Note Card outside the amount card */}
                    </YStack>
                    <XStack
                        justify="space-between"
                        items="center"
                        width="100%"
                        bg="$gray3"
                        p="$4"
                        rounded="$6"
                        minH={70}
                    >
                        <XStack gap="$3" items="center" flex={1} mr="$2">
                            <View items="center" justify="center">
                                <PenLine size="$1.5" color="$accent5" strokeWidth={2.5} />
                            </View>
                            
                            <YStack flex={1} justify="center">
                                <Input
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Add a note (optional)"
                                    size="$3"
                                    borderWidth={0}
                                    bg="transparent"
                                    autoCapitalize="sentences"
                                    autoCorrect={true}
                                    color="$color"
                                    fontSize="$5"
                                    fontWeight={800}
                                    p={0}
                                    height={30}
                                    style={{ outlineStyle: 'none' }}
                                    maxLength={80}
                                />
                            </YStack>
                        </XStack>

                        {note.length > 0 && (
                            <Button
                                size="$3"
                                circular
                                chromeless
                                icon={<XIcon size="$1.5" color="$accent5" strokeWidth={2.5} />}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setNote('');
                                }}
                            />
                        )}
                    </XStack>


                </YStack>

                {/* ── Keypad ───────────────────────────────────────────────── */}

                <NumericKeypad
                    showAmountDisplay={false}
                    value={localInputValue}
                    onValueChange={onKeypadChange}
                    onConfirm={handleGenerate}
                    confirmLabel={isGenerating ? 'Generating…' : 'Generate Request'}
                    confirmDisabled={!isValidAmount || isGenerating || !npub}
                    confirmIcon={isGenerating ? <Spinner size="small" /> : <QrCode size={20} />}
                    isLoading={isGenerating}
                />

                {/* ── Mint bottom sheet ─────────────────────────────────────── */}
                <MintSelectorSheet ref={sheetRef} />
            </YStack>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUCCESS STAGE
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <ResultStage
                status="success"
                amount={amtNum.toString()}
                mintUrl={activeMintUrl!}
                title="Request Claimed"
                onClose={onClose || handleReset}
            />
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // RESULT STAGE — NUT-18 creqA QR + detail table
    // When sender scans this, their wallet pre-fills amount + mint
    // and sends ecash directly to us
    // ────────────────────────────────────────────────────────────────────────
    return (
        <YStack flex={1} bg="$background">
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <YStack flex={1} px="$4" pb="$8" gap="$4">

                    {/* ── Hint banner ────────────────────────────────────────── */}
                    <XStack
                        mt="$4"
                        px="$4"
                        py="$2"
                        rounded="$4"
                        items="center"
                        gap="$2"
                        bg="$color3"
                        borderWidth={0.5}
                        borderColor="$borderColor"
                    >
                        <Zap size={14} color="$accent9" />
                        <Text fontSize="$2" color="$gray10" flex={1}>
                            Share or display this QR. The sender's Cashu wallet will automatically fill in the amount and mint.
                        </Text>
                    </XStack>

                    {/* ── QR Code ──────────────────────────────────────────── */}
                    <YStack items="center" gap="$4">
                        <View
                            bg="white"
                            borderWidth={1}
                            borderColor="$borderColor"
                            p="$3"
                            rounded="$5"
                        >
                            {creqString ? (
                                <QRCode
                                    value={creqString}
                                    size={320}
                                    backgroundColor="white"
                                    color="black"
                                    quietZone={8}
                                />
                            ) : (
                                <YStack width={320} height={320} items="center" justify="center">
                                    <Spinner size={36} color="$accent9" />
                                </YStack>
                            )}
                        </View>
                    </YStack>

                    {/* ── Detail Table ─────────────────────────────────────── */}
                    <YStack
                        gap="$0"
                        bg="$gray2"
                        rounded="$5"
                        overflow="hidden"
                        separator={<Separator borderColor="$borderColor" opacity={0.5} />}
                    >
                        <DetailItem label="Amount" value={currencyService.formatSats(amtNum)} />
                        <DetailItem label="Fiat" value={fiatValueLabel} />
                        <DetailItem label="Unit" value="SATOSHIS" />
                        <DetailItem label="Mint" value={displayName} />
                        {note ? <DetailItem label="Note" value={note} /> : null}
                        {targetNpub ? <DetailItem label="Sent To" value={targetUsername || `${targetNpub.slice(0, 10)}...${targetNpub.slice(-6)}`} /> : null}
                        {publishedLink ? (
                            <DetailItem
                                label="Web Link"
                                value={`${publishedLink.slice(0, 14)}…${publishedLink.slice(-6)}`}
                                isCopyable
                                onCopy={() => {
                                    Clipboard.setStringAsync(publishedLink);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    toast.show('Copied!', { message: 'Web request link copied to clipboard' });
                                }}
                                onShare={() => Share.share({ message: publishedLink })}
                            />
                        ) : null}
                        <DetailItem
                            label="Request"
                            value={creqString ? `${creqString.slice(0, 14)}…${creqString.slice(-6)}` : '—'}
                            isCopyable={!!creqString}
                            onCopy={handleCopy}
                            onShare={handleShare}
                        />
                    </YStack>

                    {/* ── Action Buttons ────────────────────────────────────── */}
                    <YStack gap="$3" mt="auto">
                        <XStack gap="$3">
                            <Button
                                flex={1}
                                size="$5"
                                theme="gray"
                                fontWeight="800"
                                rounded="$4"
                                icon={<Share2 size={20} />}
                                onPress={handleShare}
                                pressStyle={{ scale: 0.97 }}
                            >
                                Share
                            </Button>
                            <Button
                                flex={2}
                                size="$5"
                                theme="accent"
                                fontWeight="800"
                                rounded="$4"
                                icon={copied ? <Check size={20} /> : <Copy size={20} />}
                                onPress={handleCopy}
                                pressStyle={{ scale: 0.97 }}
                            >
                                {copied ? 'Copied!' : 'Copy Request'}
                            </Button>
                        </XStack>

                        {!publishedLink && (
                            <Button
                                size="$5"
                                bg="$purple10"
                                color="white"
                                fontWeight="800"
                                rounded="$4"
                                icon={isPublishing ? <Spinner size="small" color="white" /> : <Globe size={20} />}
                                onPress={handlePublish}
                                disabled={isPublishing}
                                pressStyle={{ scale: 0.97, bg: "$purple11" }}
                            >
                                {isPublishing ? 'Publishing...' : 'Publish on bey.cash'}
                            </Button>
                        )}

                        <XStack justify="center" gap="$4">
                            <Button
                                chromeless
                                size="$3"
                                icon={isChecking ? <Spinner size="small" color="$accent9" /> : <RefreshCw size={14} color="$accent9" />}
                                onPress={handleCheckStatus}
                                disabled={isChecking}
                                pressStyle={{ opacity: 0.7 }}
                            >
                                <Text fontSize="$2" color="$accent10" fontWeight="700">Check Status</Text>
                            </Button>
                            <Button
                                chromeless
                                size="$3"
                                icon={<RefreshCw size={14} color="$gray10" />}
                                onPress={handleReset}
                                pressStyle={{ opacity: 0.7 }}
                            >
                                <Text fontSize="$2" color="$gray10">New Request</Text>
                            </Button>
                        </XStack>
                    </YStack>
                </YStack>
            </ScrollView>

            <ProcessingSheet
                isOpen={isGenerating || !!generateError}
                state={generateError ? 'error' : 'processing'}
                title={generateError ? "Request Failed" : "Creating Request"}
                message={generateError ? generateError : "Generating your Nostr ecash request..."}
                error={generateError || undefined}
                onClose={() => setGenerateError(null)}
            />
        </YStack>
    );
}
