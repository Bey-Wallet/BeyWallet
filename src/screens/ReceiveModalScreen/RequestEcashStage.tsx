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
} from 'tamagui';
import {
    QrCode,
    Copy,
    Share2,
    Check,
    AlertCircle,
    Sprout,
    ShieldCheck,
    ShieldOff,
    RefreshCw,
    Building2,
    ChevronDown,
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
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '../../services/currencyService';

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestStep = 'amount' | 'result';

interface RequestEcashStageProps {
    /** Called to navigate back when on the result stage */
    onClose?: () => void;
}

// ─── Detail Row (same pattern as nostr-profile & PendingTokenLayout) ─────────

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
            <Text fontSize="$4" color="$gray10" fontWeight="600">
                {label}
            </Text>
            <XStack gap="$2" items="center">
                <Text
                    fontSize="$5"
                    fontWeight="800"
                    color="$color"
                    numberOfLines={1}
                    style={{ maxWidth: 180 }}
                >
                    {value}
                </Text>
                {onShare && (
                    <Button
                        size="$2"
                        chromeless
                        icon={<Share2 size={16} color="$gray10" />}
                        onPress={onShare}
                    />
                )}
                {isCopyable && (
                    <Button
                        size="$2"
                        chromeless
                        icon={<Copy size={16} color="$gray10" />}
                        onPress={onCopy}
                    />
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

    // Draft QR — replaced with real mint call when logic is implemented
    const [qrValue, setQrValue] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const sheetRef = useRef<AppBottomSheetRef>(null);
    const toast = useToastController();

    const { activeMintUrl, mints, setActiveMint } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();

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
    const isValidAmount = amtNum > 0;

    // ── Conversion label shown below the main amount ─────────────────────────
    const conversionLabel = React.useMemo(() => {
        if (!btcData?.price) return '~';
        if (inputMode === 'SATS') {
            const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
            return `${currencySymbol}${val.toFixed(2)}`;
        } else {
            return `₿${amtNum}`;
        }
    }, [amtNum, btcData?.price, inputMode, currencySymbol]);

    const fiatValueLabel = React.useMemo(() => {
        if (!btcData?.price || !amtNum) return '—';
        const val = currencyService.convertSatsToCurrency(amtNum, btcData.price);
        return `${currencySymbol}${val.toFixed(2)}`;
    }, [amtNum, btcData?.price, currencySymbol]);

    // ── Keypad change ────────────────────────────────────────────────────────
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

    // ── Mint selection ───────────────────────────────────────────────────────
    const handleSelectMint = (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
    };

    // ── Draft generate (TODO: replace with real mint call) ───────────────────
    const handleGenerate = useCallback(async () => {
        if (!isValidAmount) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsGenerating(true);
        // Simulate async mint call
        await new Promise((r) => setTimeout(r, 800));
        const draftToken = `cashuAEYEREQUEST_DRAFT_${Date.now()}_${amtNum}sats`;
        setQrValue(draftToken);
        setIsGenerating(false);
        setStep('result');
    }, [amtNum, isValidAmount]);

    // ── Copy / Share ─────────────────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
        if (!qrValue) return;
        await Clipboard.setStringAsync(qrValue);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        toast.show('Copied!', { message: 'Token copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
    }, [qrValue]);

    const handleShare = useCallback(async () => {
        if (!qrValue) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await Share.share({ message: qrValue });
    }, [qrValue]);

    const handleReset = () => {
        setStep('amount');
        setQrValue(null);
        setCopied(false);
    };

    // ────────────────────────────────────────────────────────────────────────
    // AMOUNT STAGE
    // ────────────────────────────────────────────────────────────────────────
    if (step === 'amount') {
        return (
            <YStack flex={1} p="$4" justify="space-between">
                {/* ── Card (mirrors AmountStage layout) ──────────────────── */}
                <YStack
                    width="100%"
                    height={300}
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
                        <XStack gap="$2" items="center">
                            <Building2 size={18} strokeWidth={2.5} color="$color" />
                        </XStack>
                        <Text fontWeight="800" fontSize="$4">{mintName}</Text>
                        <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                    </XStack>

                    {/* Amount display */}
                    <YStack items="center" gap="$1">
                        <Text color="$gray10" fontSize="$3">How much to request?</Text>
                        <H1
                            fontWeight="400"
                            letterSpacing={-2}
                            py="$4"
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

                    {/* Bottom info row */}
                    <XStack
                        width="100%"
                        p="$3"
                        borderTopWidth={1}
                        borderTopColor="$color3"
                        justify="center"
                        items="center"
                    >
                        <Text color="$gray10" fontWeight="400" fontSize="$3">
                            Generates a Cashu payment request QR
                        </Text>
                    </XStack>
                </YStack>

                {/* ── Keypad ─────────────────────────────────────────────── */}
                <NumericKeypad
                    showAmountDisplay={false}
                    value={localInputValue}
                    onValueChange={onKeypadChange}
                    onConfirm={handleGenerate}
                    confirmLabel={isGenerating ? 'Generating…' : 'Generate QR'}
                    confirmDisabled={!isValidAmount || isGenerating}
                    confirmIcon={isGenerating ? <Spinner size="small" /> : <QrCode size={20} />}
                    isLoading={isGenerating}
                />

                {/* ── Mint bottom sheet ───────────────────────────────────── */}
                <AppBottomSheet ref={sheetRef} snapPoints={['50%', '85%']}>
                    <YStack p="$4" gap="$3" flex={1}>
                        <XStack justify="space-between" items="center" mb="$2">
                            <Text fontSize="$6" color="$accent5" fontWeight="bold">Select Mint</Text>
                        </XStack>
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
    // RESULT STAGE — QR + Detail Table 
    // ────────────────────────────────────────────────────────────────────────
    return (
        <YStack flex={1} bg="$background">
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <YStack flex={1} px="$4" pb="$8" gap="$6">
                    {/* ── QR Code ──────────────────────────────────────────── */}
                    <YStack items="center" gap="$4" mt="$4">
                        <View bg="white" p="$3" rounded="$5">
                            {qrValue ? (
                                <QRCode
                                    value={qrValue}
                                    size={310}
                                    backgroundColor="white"
                                    color="black"
                                    quietZone={8}
                                />
                            ) : (
                                <YStack width={240} height={240} items="center" justify="center">
                                    <Spinner size={36} color="$accent9" />
                                </YStack>
                            )}
                        </View>


                    </YStack>

                    {/* ── Detail Table (nostr-profile pattern) ─────────────── */}
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
                        <DetailItem
                            label="Mint"
                            value={mintName}
                        />
                        <DetailItem
                            label="Token"
                            value={qrValue ? `${qrValue.slice(0, 12)}…${qrValue.slice(-6)}` : '—'}
                            isCopyable={!!qrValue}
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
                                {copied ? 'Copied!' : 'Copy Token'}
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
