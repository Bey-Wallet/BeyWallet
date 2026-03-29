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
// NUT-18: Cashu Payment Request
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';

/** Simple unique ID — avoids a uuid dependency */
const makeRequestId = () =>
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'amount' | 'result';

interface RequestEcashStageProps {
    onClose?: () => void;
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

export function RequestEcashStage({ onClose }: RequestEcashStageProps) {
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
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const sheetRef = useRef<AppBottomSheetRef>(null);
    const toast = useToastController();

    const { activeMintUrl, mints, setActiveMint } = useWalletStore();
    const { secondaryCurrency, npub } = useSettingsStore();
    const { addRequest } = useNostrRequestStore();

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
            // NOSTR transport using the user's npub (hex pubkey for routing)
            const transports = npub ? [
                {
                    type: PaymentRequestTransportType.NOSTR,
                    target: npub,
                    tags: [],
                }
            ] : [];

            const pr = new PaymentRequest(
                transports,
                undefined,
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

                        <Button
                            chromeless
                            size="$3"
                            alignSelf="center"
                            icon={<RefreshCw size={14} color="$gray10" />}
                            onPress={handleReset}
                            pressStyle={{ opacity: 0.7 }}
                        >
                            <Text fontSize="$2" color="$gray10">New Request</Text>
                        </Button>
                    </YStack>
                </YStack>
            </ScrollView>
        </YStack>
    );
}
