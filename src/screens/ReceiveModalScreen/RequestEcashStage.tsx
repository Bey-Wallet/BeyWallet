import React, { useState, useCallback, useRef } from 'react';
import {
    YStack,
    XStack,
    Text,
    H1,
    Button,
    Separator,
    ScrollView,
    View,
    ListItem,
    Input,
} from 'tamagui';
import { DeviceEventEmitter } from 'react-native';
import {
    QrCode,
    Copy,
    Share2,
    Check,
    Sprout,
    ShieldCheck,
    ShieldOff,
    RefreshCw,
    Building2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Zap,
} from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import { NumericKeypad } from '../../components/UI/NumericKeypad';
import AppBottomSheet, { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
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
import { currencyService, SUPPORTED_CURRENCIES } from '../../services/currencyService';
import { walletService } from '../../services/core/walletService';
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';
import { decode as nip19Decode, nprofileEncode } from 'nostr-tools/nip19';
import { ResultStage } from '../SendModalScreen/ResultStage';

/** Simple unique ID — avoids a uuid dependency */
const makeRequestId = () =>
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'amount' | 'result' | 'success';

interface RequestEcashStageProps {
    onClose?: () => void;
    initialRequestId?: string;
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

export function RequestEcashStage({ onClose, initialRequestId }: RequestEcashStageProps) {
    const [step, setStep] = useState<RequestStep>('amount');
    const [amount, setAmount] = useState('0');
    const [localInputValue, setLocalInputValue] = useState('0');
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>('SATS');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);

    // NUT-18 payment request
    const [creqString, setCreqString] = useState<string | null>(null);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const sheetRef = useRef<AppBottomSheetRef>(null);
    const toast = useToastController();

    const { activeMintUrl, mints, setActiveMint } = useWalletStore();
    const { secondaryCurrency, npub } = useSettingsStore();
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
                        setShowNote(true);
                    }
                    setStep('result');
                }
            });
        }
    }, [initialRequestId]);

    const activeMint = mints.find(
        (m) => m.mintUrl.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, ''),
    );
    const mintName =
        activeMint?.nickname ||
        activeMint?.name ||
        activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
        'Select Mint';

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
        return `₿${amtNum}`;
    }, [amtNum, btcData?.price, inputMode, currencySymbol]);

    const fiatValueLabel = React.useMemo(() => {
        if (!btcData?.price || !amtNum) return '—';
        const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
        return `${currencySymbol}${val.toFixed(2)}`;
    }, [amtNum, btcData?.price, currencySymbol]);

    // ── Keypad ────────────────────────────────────────────────────────────────
    const onKeypadChange = (val: string) => {
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
                const fiat = currencyService.convertSatsToCurrency(amtNum, btcData.price);
                setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
            }
            setInputMode('FIAT');
        } else {
            setLocalInputValue(amount);
            setInputMode('SATS');
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
                    tags: [],
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

            // ── Persist request to local DB so E-Cash screen shows it ──────────
            const reqId = makeRequestId();
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
    };

    // ── Real-Time Nostr Listener ──────────────────────────────────────────────
    React.useEffect(() => {
        if (step !== 'result') return;

        // Listen for incoming tokens BEFORE they are claimed!
        const subIncoming = DeviceEventEmitter.addListener('nostr:incoming', async (data: any) => {
            console.log('[RequestEcashStage] Received nostr:incoming event:', data);
            
            const isMatch = (data.requestId && data.requestId === currentRequestId) || 
                            (data.amount === amtNum && data.mintUrl?.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, ''));
            
            if (isMatch) {
                console.log('[RequestEcashStage] Auto-claiming matched incoming payment...');
                try {
                    const { useSettingsStore } = require('../../store/settingsStore');
                    const { useNostrInboxStore } = require('../../store/nostrInboxStore');
                    const nsec = useSettingsStore.getState().nsec;
                    let privkeyHex = null;

                    if (nsec) {
                        try {
                            if (nsec.startsWith('nsec')) {
                                const decoded = nip19Decode(nsec);
                                const bytes = decoded.data as Uint8Array;
                                privkeyHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                            } else {
                                privkeyHex = nsec; // Already hex
                            }
                        } catch { /* ignore */ }
                    }

                    if (privkeyHex) {
                        await walletService.receiveP2PK(data.tokenString, privkeyHex);
                    } else {
                        await walletService.receive(data.tokenString);
                    }

                    // Mark as claimed in inbox so NostrClaimSheet doesn't show it again
                    useNostrInboxStore.getState().markClaimed(data.eventId);
                    
                    // Mark as received in pending requests
                    if (currentRequestId) {
                        await useNostrRequestStore.getState().markReceived(currentRequestId);
                    }
                    
                    useWalletStore.getState().refreshBalance();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setStep('success');
                } catch (e) {
                    console.error('[RequestEcashStage] Auto-claim failed:', e);
                }
            }
        });

        const subReceived = DeviceEventEmitter.addListener('nostr:received', (data: any) => {
            console.log('[RequestEcashStage] Received nostr:received event:', data);
            
            // Check if this payment matches our current request
            const isMatch = (data.requestId && data.requestId === currentRequestId) || 
                            (data.amount === amtNum && data.mintUrl?.replace(/\/$/, '') === activeMintUrl?.replace(/\/$/, ''));
            
            if (isMatch) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setStep('success');
            }
        });

        return () => {
            subIncoming.remove();
            subReceived.remove();
        };
    }, [step, currentRequestId, amtNum, activeMintUrl]);

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
                setStep('success');
            } else {
                toast.show('Still Pending', { message: 'No payment received yet.' });
            }
        } catch (e) {
            console.warn('[RequestEcashStage] check status error:', e);
        } finally {
            setIsChecking(false);
        }
    }, [currentRequestId, loadPendingRequests, toast]);

    // ────────────────────────────────────────────────────────────────────────
    // AMOUNT STAGE
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'amount') {
        return (
            <YStack flex={1} p="$4" justify="space-between">
                {/* ── Card ──────────────────────────────────────────────────── */}
                <YStack
                    width="100%"
                    rounded="$4"
                    borderWidth={0.5}
                    borderColor="$borderColor"
                    justify="space-between"
                    bg="$color2"
                    items="center"
                >
                    {/* Mint selector row */}
                    <XStack
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                            sheetRef.current?.present();
                        }}
                        width="100%"
                        p="$3"
                        items="center"
                        borderBottomWidth={1}
                        borderBottomColor="$color3"
                        justify="space-between"
                        pressStyle={{ bg: '$color5', opacity: 0.8, rounded: '$4' }}
                    >
                        <Building2 size={18} strokeWidth={2.5} color="$color" />
                        <Text fontWeight="800" fontSize="$4">{mintName}</Text>
                        <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                    </XStack>

                    {/* Amount display */}
                    <YStack items="center" gap="$1" py="$5">
                        <Text color="$gray10" fontSize="$3">How much to request?</Text>
                        <H1
                            fontWeight="400"
                            letterSpacing={-2}
                            py="$3"
                            color={amtNum === 0 ? '$gray7' : '$color'}
                        >
                            {inputMode === 'SATS'
                                ? `₿${localInputValue || '0'}`
                                : `${currencySymbol}${localInputValue || '0'}`}
                        </H1>
                        <Button
                            size="$2.5"
                            theme="gray"
                            fontWeight="400"
                            color="$accent9"
                            mt="$-2"
                            onPress={toggleMode}
                            pressStyle={{ scale: 0.95 }}
                        >
                            {conversionLabel}
                        </Button>
                    </YStack>

                    {/* Optional note row */}
                    <XStack
                        width="100%"
                        borderTopWidth={1}
                        borderTopColor="$color3"
                        px="$3"
                        py="$2"
                        items="center"
                        gap="$2"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowNote((v) => !v);
                        }}
                        pressStyle={{ opacity: 0.7 }}
                    >
                        <Text fontSize="$3" color="$gray9" flex={1}>
                            {note || 'Add a note (optional)'}
                        </Text>
                        {showNote ? <ChevronUp size={16} color="$gray9" /> : <ChevronDown size={16} color="$gray9" />}
                    </XStack>

                    {showNote && (
                        <XStack width="100%" px="$3" py="$2" borderTopWidth={0.5} borderTopColor="$color3">
                            <Input
                                value={note}
                                onChangeText={setNote}
                                placeholder="What's this for?"
                                bg="transparent"
                                borderWidth={0}
                                flex={1}
                                fontSize="$3"
                                p={0}
                                placeholderTextColor="$gray8"
                                autoFocus
                                maxLength={80}
                            />
                        </XStack>
                    )}
                </YStack>

                {/* ── Error ────────────────────────────────────────────────── */}
                {generateError && (
                    <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mt="$2">
                        <AlertCircle size={18} color="$red10" />
                        <Text color="$red10" fontSize="$3" flex={1}>{generateError}</Text>
                    </XStack>
                )}

                {!activeMintUrl && (
                    <XStack bg="$orange3" p="$3" rounded="$3" gap="$2" items="center" mt="$2">
                        <AlertCircle size={18} color="$orange10" />
                        <Text color="$orange10" fontSize="$3" flex={1}>Select a mint to generate a request</Text>
                    </XStack>
                )}
                
                {!npub && (
                    <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mt="$2">
                        <AlertCircle size={18} color="$red10" />
                        <Text color="$red10" fontSize="$3" flex={1}>Nostr profile required to receive directly. Go to Profile to generate.</Text>
                    </XStack>
                )}

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
                <AppBottomSheet ref={sheetRef} snapPoints={['50%', '85%']}>
                    <YStack p="$4" gap="$3" flex={1}>
                        <Text fontSize="$6" color="$accent5" fontWeight="bold">Select Mint</Text>
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            <YStack gap="$2" pb="$4">
                                {mints.length === 0 ? (
                                    <YStack items="center" py="$6" gap="$2">
                                        <Sprout size={40} color="$gray8" />
                                        <Text color="$gray10">No mints added yet</Text>
                                    </YStack>
                                ) : (
                                    mints.map((mint) => (
                                        <ListItem
                                            key={mint.mintUrl}
                                            size="$4"
                                            px="$2"
                                            hoverTheme
                                            pressTheme
                                            theme="gray"
                                            rounded="$4"
                                            borderWidth={mint.mintUrl === activeMintUrl ? 1 : 0}
                                            borderColor="$borderColor"
                                            bg={mint.mintUrl === activeMintUrl ? '$color2' : 'transparent'}
                                            onPress={() => handleSelectMint(mint.mintUrl)}
                                            icon={
                                                <View bg={mint.trusted ? '$green4' : '$gray4'} p="$2" rounded="$10">
                                                    {mint.trusted ? (
                                                        <ShieldCheck size={20} color="$green10" />
                                                    ) : (
                                                        <ShieldOff size={20} color="$gray10" />
                                                    )}
                                                </View>
                                            }
                                            title={mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                            subTitle={mint.mintUrl.replace('https://', '')}
                                        />
                                    ))
                                )}
                            </YStack>
                        </BottomSheetScrollView>
                    </YStack>
                </AppBottomSheet>
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
                        <DetailItem label="Amount" value={`₿${amtNum} sats`} />
                        <DetailItem label="Fiat" value={fiatValueLabel} />
                        <DetailItem label="Unit" value="SATOSHIS" />
                        <DetailItem label="Mint" value={mintName} />
                        {note ? <DetailItem label="Note" value={note} /> : null}
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
        </YStack>
    );
}
