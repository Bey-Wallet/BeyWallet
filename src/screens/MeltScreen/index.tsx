import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { InvoiceStage } from './InvoiceStage';
import { MeltResultStage } from './ResultStage';
import { OnchainMeltFlow } from './OnchainMeltFlow';
import { quotesService, mintManager } from '~/services/core';
import { detectLightningInputType, requestInvoiceFromLnurl, getLnurlPayParams } from '~/services/lnurlService';
import { biometricService } from '~/services/biometricService';
import { networkService } from '~/services/networkService';
import * as Haptics from 'expo-haptics';
import { Text, YStack, XStack, Button, Separator, View, H1, Image, YGroup, ScrollView, Avatar } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES, CurrencyCode } from '~/services/currencyService';
import { Landmark, Zap, ShieldCheck, ArrowDownCircle, AlertCircle, Sprout } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import { NumericKeypad } from '~/components/UI/NumericKeypad';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';

type MeltStep = 'invoice' | 'confirm' | 'result';

export default function MeltScreen() {
    const { mode } = useLocalSearchParams<{ mode?: string }>();

    if (mode === 'onchain') {
        return (
            <YStack flex={1} bg="$background" px="$4">
                <Stack.Screen options={{ headerTitle: 'On-Chain Send' }} />
                <OnchainMeltFlow />
            </YStack>
        );
    }

    const [step, setStep] = useState<MeltStep>('invoice');
    const [invoice, setInvoice] = useState('');
    const [resolvedInvoice, setResolvedInvoice] = useState<string | null>(null);
    const [lnAddress, setLnAddress] = useState<string | null>(null);
    const [lnAddressAmount, setLnAddressAmount] = useState('0');
    const [status, setStatus] = useState<'success' | 'error'>('success');
    const [error, setError] = useState<string | null>(null);
    const [isGettingQuote, setIsGettingQuote] = useState(false);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [quoteAmount, setQuoteAmount] = useState(0);
    const [feeReserve, setFeeReserve] = useState(0);
    const [quoteId, setQuoteId] = useState<string | null>(null);
    const router = useRouter();

    const balance = useWalletStore(s => s.balance);
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const mints = useWalletStore(s => s.mints);
    const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

    // Auto-fetch quote for bolt11 invoice to display its amount immediately
    useEffect(() => {
        const cleaned = invoice.trim();
        if (!cleaned) {
            setLnAddressAmount('0');
            return;
        }

        const inputType = detectLightningInputType(cleaned);
        if (inputType === 'bolt11' && activeMintUrl) {
            setIsGettingQuote(true);
            setError(null);
            quotesService.createMeltQuote(activeMintUrl, cleaned)
                .then(quote => {
                    console.log('[MeltScreen] Auto-fetched melt quote amount:', quote.amount);
                    setQuoteAmount(quote.amount);
                    setFeeReserve(quote.fee_reserve);
                    setQuoteId(quote.quote);
                    setLnAddressAmount(quote.amount.toString());
                })
                .catch(err => {
                    console.error('[MeltScreen] Auto-quote failed:', err);
                    setError(err.message || 'Failed to parse invoice amount');
                })
                .finally(() => {
                    setIsGettingQuote(false);
                });
        }
    }, [invoice, activeMintUrl]);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const activeMint = useMemo(() => {
        if (!activeMintUrl) return null;
        return mints.find(m => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
    }, [mints, activeMintUrl]);

    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || "Unknown Mint";

    const totalCost = quoteAmount + feeReserve;

    const fiatValue = useMemo(() => {
        if (!btcData?.price) return '...';
        const cur = SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency);
        const symbol = cur?.symbol || '$';
        const val = currencyService.convertSatsToCurrency(quoteAmount, btcData.price);
        return `${symbol}${val.toFixed(2)}`;
    }, [quoteAmount, btcData?.price, secondaryCurrency]);

    const totalFiatValue = useMemo(() => {
        if (!btcData?.price) return '...';
        const cur = SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency);
        const symbol = cur?.symbol || '$';
        const val = currencyService.convertSatsToCurrency(totalCost, btcData.price);
        return `${symbol}${val.toFixed(2)}`;
    }, [totalCost, btcData?.price, secondaryCurrency]);

    // ─── Invoice Stage: Continue Handler ──────────────────────
    const handleInvoiceContinue = useCallback(async () => {
        if (!activeMintUrl) {
            setError('No active mint selected');
            return;
        }

        const offline = await networkService.isOffline();
        if (offline) {
            setError('You are offline. Please check your internet connection.');
            return;
        }

        const cleaned = invoice.trim();
        if (!cleaned) {
            setError('Please enter a Lightning invoice or address');
            return;
        }

        const inputType = detectLightningInputType(cleaned);
        console.log('[MeltScreen] Input type:', inputType);

        if (inputType === 'bolt11') {
            // Bolt11 invoice — go directly to get quote
            await getQuoteForInvoice(cleaned);
        } else if (inputType === 'address' || inputType === 'lnurlp') {
            // Lightning address or LNURL — need to resolve to invoice
            setLnAddress(cleaned);
            setError(null);
            setIsResolvingAddress(true);

            try {
                // Fetch LNURL params to get min/max amounts
                const params = await getLnurlPayParams(cleaned);
                if (!params) {
                    setError('Could not resolve Lightning address. Check the address and try again.');
                    setIsResolvingAddress(false);
                    return;
                }

                const minSats = Math.ceil(params.minSendable / 1000);
                const maxSats = Math.floor(params.maxSendable / 1000);

                const amountSats = parseInt(lnAddressAmount, 10);
                if (isNaN(amountSats) || amountSats <= 0) {
                    setError('Enter a valid amount');
                    setIsResolvingAddress(false);
                    return;
                }

                if (amountSats < minSats) {
                    setError(`Minimum amount is ${minSats} sats`);
                    setIsResolvingAddress(false);
                    return;
                }

                if (amountSats > maxSats) {
                    setError(`Maximum amount is ${maxSats} sats`);
                    setIsResolvingAddress(false);
                    return;
                }

                if (amountSats > balance) {
                    setError('Insufficient balance');
                    setIsResolvingAddress(false);
                    return;
                }

                console.log(`[MeltScreen] LN address resolved: amount=${amountSats} sats`);
                await resolveAndGetQuote(cleaned, amountSats);
            } catch (err: any) {
                console.error('[MeltScreen] LN address resolution failed:', err);
                setError(err.message || 'Failed to resolve Lightning address');
            } finally {
                setIsResolvingAddress(false);
            }
        } else {
            setError('Invalid input. Enter a Lightning invoice (lnbc...) or Lightning address (user@domain.com)');
        }
    }, [activeMintUrl, invoice, lnAddressAmount, balance, resolveAndGetQuote]);

    // ─── Resolve LN address to invoice and get quote ──────────
    const resolveAndGetQuote = useCallback(async (address: string, amountSats: number) => {
        setIsGettingQuote(true);
        setError(null);

        try {
            console.log(`[MeltScreen] Resolving ${address} for ${amountSats} sats...`);
            const bolt11 = await requestInvoiceFromLnurl(address, amountSats);
            setResolvedInvoice(bolt11);
            console.log('[MeltScreen] Resolved to invoice:', bolt11.substring(0, 40) + '...');
            await getQuoteForInvoice(bolt11);
        } catch (err: any) {
            console.error('[MeltScreen] Resolution failed:', err);
            setError(err.message || 'Failed to get invoice from Lightning address');
            setIsGettingQuote(false);
        }
    }, [activeMintUrl, balance]);

    // ─── Get melt quote for a bolt11 invoice ──────────────────
    const getQuoteForInvoice = useCallback(async (bolt11: string) => {
        if (!activeMintUrl) return;

        const offline = await networkService.isOffline();
        if (offline) {
            setError('You are offline. Please check your internet connection.');
            return;
        }

        setIsGettingQuote(true);
        setError(null);

        try {
            console.log('[MeltScreen] Getting melt quote from', activeMintUrl);
            const quote = await quotesService.createMeltQuote(activeMintUrl, bolt11);

            console.log('[MeltScreen] Quote:', JSON.stringify(quote));
            setQuoteAmount(quote.amount);
            setFeeReserve(quote.fee_reserve);
            setQuoteId(quote.quote);

            // Check balance sufficiency
            if (quote.amount + quote.fee_reserve > balance) {
                setError(`Insufficient balance. Need ${quote.amount + quote.fee_reserve} sats (${quote.amount} + ${quote.fee_reserve} fee reserve), have ${balance} sats.`);
                setIsGettingQuote(false);
                return;
            }

            // Go to confirm step
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep('confirm');
        } catch (err: any) {
            console.error('[MeltScreen] Quote failed:', err);
            setError(err.message || 'Failed to get melt quote');
        } finally {
            setIsGettingQuote(false);
        }
    }, [activeMintUrl, balance]);



    // ─── Pay Handler ──────────────────────────────────────────
    const handlePay = useCallback(async () => {
        if (!activeMintUrl || !quoteId) return;

        const offline = await networkService.isOffline();
        if (offline) {
            setError('You are offline. Please check your internet connection.');
            return;
        }

        setIsPaying(true);
        setError(null);

        try {
            console.log('[MeltScreen] Paying melt quote:', quoteId);
            await quotesService.payMeltQuote(activeMintUrl, quoteId);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setStatus('success');
            refreshBalance();
            setStep('result');
        } catch (err: any) {
            console.error('[MeltScreen] Payment failed:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(err.message || 'Lightning payment failed');
            setStatus('error');
            setStep('result');
        } finally {
            setIsPaying(false);
        }
    }, [activeMintUrl, quoteId, refreshBalance]);

    // ─── Auth Handler ─────────────────────────────────────────
    const handleAuthenticate = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const success = await biometricService.authenticateAsync(
                `Pay Lightning ${currencyService.formatSats(quoteAmount)}`
            );

            if (success) {
                await handlePay();
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (err: any) {
            console.error('[MeltScreen] Auth error:', err);
            setError(err.message || 'Authentication failed');
            setStatus('error');
            setStep('result');
        }
    };

    const handleClose = () => {
        router.back();
        InteractionManager.runAfterInteractions(() => refreshBalance());
    };

    return (
        <YStack flex={1} bg="$background">
            {/* Step 1: Input Invoice and Amount Stage */}
            {step === 'invoice' && (
                <YStack flex={1} px="$4">
                    <InvoiceStage
                        amount={lnAddressAmount}
                        setAmount={setLnAddressAmount}
                        invoice={invoice}
                        setInvoice={setInvoice}
                        onContinue={handleInvoiceContinue}
                        balance={balance}
                        isLoading={isGettingQuote || isResolvingAddress}
                        error={error}
                    />
                </YStack>
            )}

            {/* Step 2: Confirm */}
            {step === 'confirm' && (
                <YStack flex={1}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 180 } as any} showsVerticalScrollIndicator={false}>
                        <YStack gap="$4" >
                            {/* Middle Amount Display */}
                            <YStack gap="$3" py="$6" items="center" justify="center">
                                <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                                    -{showBitcoinSymbol ? `₿${quoteAmount.toLocaleString()}` : `${quoteAmount.toLocaleString()} SATS`}
                                </Text>
                                <Text color="$accent5" fontWeight="600" fontSize={16}>
                                    ≈ {fiatValue} {secondaryCurrency}
                                </Text>
                            </YStack>

                            {/* Badge */}
                            <XStack
                                self="center"
                                items="center"
                                gap="$2"
                                bg="$yellow9"
                                px="$4"
                                py="$3"
                                rounded="$10"
                            >
                                <Zap size={16} color="black" />
                                <Text
                                    fontSize="$3"
                                    fontWeight="700"
                                    color="black"
                                >
                                    Lightning Payment Send
                                </Text>
                            </XStack>

                            {/* Details List */}
                            <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3" mx="$4">
                                <View p="$3" px="$4">
                                    <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                                </View>
                                <Separator borderColor="$borderColor" opacity={0.3} />
                                <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                    <DetailItem
                                        label="Mint"
                                        value={mintName}
                                        icon={
                                            <Avatar rounded="$3" size="$1.5">
                                                <Avatar.Image src={activeMint?.icon} />
                                                <Avatar.Fallback bg="$green3" items="center" justify="center">
                                                    <Sprout size={12} color="$green10" />
                                                </Avatar.Fallback>
                                            </Avatar>
                                        }
                                    />
                                    <DetailItem
                                        label="Method"
                                        value="Lightning Send"
                                        icon={<Zap size={16} color="$yellow10" />}
                                    />
                                    <DetailItem
                                        label="Fee Reserve"
                                        value={feeReserve > 0 ? `~${feeReserve} sats` : '0 sats'}
                                        valueColor={feeReserve > 0 ? "$orange10" : "$green11"}
                                        icon={<ShieldCheck size={16} color={feeReserve > 0 ? "$orange10" : "$green11"} />}
                                    />
                                    <DetailItem
                                        label="Total Cost"
                                        value={`${totalCost.toLocaleString()} sats (≈ ${totalFiatValue})`}
                                        valueColor="$accent10"
                                        icon={<ShieldCheck size={16} color="$accent10" />}
                                    />
                                    {lnAddress && (
                                        <DetailItem
                                            label="Recipient"
                                            value={lnAddress}
                                        />
                                    )}
                                </YGroup>
                            </YStack>

                            {/* Balance Warning */}
                            {totalCost > balance && (
                                <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mx="$4">
                                    <AlertCircle size={18} color="$red10" />
                                    <Text color="$red10" fontSize="$3">Insufficient balance ({balance} sats available)</Text>
                                </XStack>
                            )}
                        </YStack>
                    </ScrollView>

                    {/* Fixed Action Buttons */}
                    <XStack position="absolute"  b="$4" l="$4" r="$4" gap="$2">
                       
                        <Button
                            bg="$gray3"
                            color="$color"
                            size="$5"
                            flex={1}
                            height={55}
                            rounded="$5"
                            fontWeight="800"
                            disabled={isPaying}
                            onPress={() => setStep('invoice')}
                        >
                            Go Back
                        </Button>
                         <Button
                            theme="accent"
                            size="$5"
                            flex={1}
                            height={55}
                            rounded="$5"
                            fontWeight="800"
                            onPress={handleAuthenticate}
                            disabled={isPaying || totalCost > balance}
                            icon={isPaying ? <Spinner size="small" color="white" /> : undefined}
                        >
                            {isPaying ? 'Paying...' : 'Pay'}
                        </Button>
                    </XStack>
                </YStack>
            )}

            {/* Step 3: Result */}
            {step === 'result' && (
                <YStack flex={1} p="$4">
                    <MeltResultStage
                        status={status}
                        amount={quoteAmount}
                        feeReserve={feeReserve}
                        error={error}
                        onClose={handleClose}
                    />
                </YStack>
            )}

            <ProcessingSheet
                visible={isPaying}
                title="Processing Payment"
                amount={quoteAmount}
                detail={lnAddress ? `Paying ${lnAddress}` : 'Paying Lightning Invoice'}
                direction="send"
            />
        </YStack>
    );
}

function DetailItem({ label, value, icon, valueColor }: { label: string, value: string, icon?: React.ReactNode, valueColor?: string }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" fontWeight="800" color={valueColor || "$color"} numberOfLines={1} style={{ maxWidth: 220 }}>
                    {value}
                </Text>
            </XStack>
        </XStack>
    );
}
