import React, { useState, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { InvoiceStage } from './InvoiceStage';
import { MeltResultStage } from './ResultStage';
import { quotesService, mintManager } from '~/services/core';
import { detectLightningInputType, requestInvoiceFromLnurl, getLnurlPayParams } from '~/services/lnurlService';
import { biometricService } from '~/services/biometricService';
import * as Haptics from 'expo-haptics';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { Text, YStack, XStack, Button, Separator, View, H1, Image } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { Building2, Zap, ShieldCheck, ArrowDownCircle, AlertCircle } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import { NumericKeypad } from '~/components/UI/NumericKeypad';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';

type MeltStep = 'invoice' | 'amount' | 'result';

export default function MeltScreen() {
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
    const [lnMinSats, setLnMinSats] = useState(1);
    const [lnMaxSats, setLnMaxSats] = useState(Infinity);
    const router = useRouter();

    const balance = useWalletStore(s => s.balance);
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const mints = useWalletStore(s => s.mints);
    const { secondaryCurrency } = useSettingsStore();
    const confirmSheetRef = React.useRef<AppBottomSheetRef>(null);

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

    // ─── Invoice Stage: Continue Handler ──────────────────────
    const handleInvoiceContinue = useCallback(async () => {
        if (!activeMintUrl) {
            setError('No active mint selected');
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
                setLnMinSats(minSats);
                setLnMaxSats(maxSats);
                setLnAddressAmount(minSats.toString());

                console.log(`[MeltScreen] LN address resolved: min=${minSats}, max=${maxSats} sats`);

                // If min === max, skip amount input
                if (minSats === maxSats) {
                    await resolveAndGetQuote(cleaned, minSats);
                } else {
                    setStep('amount');
                }
            } catch (err: any) {
                console.error('[MeltScreen] LN address resolution failed:', err);
                setError(err.message || 'Failed to resolve Lightning address');
            } finally {
                setIsResolvingAddress(false);
            }
        } else {
            setError('Invalid input. Enter a Lightning invoice (lnbc...) or Lightning address (user@domain.com)');
        }
    }, [activeMintUrl, invoice]);

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

            // Show confirmation sheet
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            confirmSheetRef.current?.present();
        } catch (err: any) {
            console.error('[MeltScreen] Quote failed:', err);
            setError(err.message || 'Failed to get melt quote');
        } finally {
            setIsGettingQuote(false);
        }
    }, [activeMintUrl, balance]);

    // ─── Amount Stage: Continue Handler ───────────────────────
    const handleAmountContinue = useCallback(async () => {
        if (!lnAddress) return;

        const amountSats = parseInt(lnAddressAmount, 10);
        if (isNaN(amountSats) || amountSats <= 0) {
            setError('Enter a valid amount');
            return;
        }

        if (amountSats < lnMinSats) {
            setError(`Minimum amount is ${lnMinSats} sats`);
            return;
        }

        if (amountSats > lnMaxSats) {
            setError(`Maximum amount is ${lnMaxSats} sats`);
            return;
        }

        if (amountSats > balance) {
            setError('Insufficient balance');
            return;
        }

        await resolveAndGetQuote(lnAddress, amountSats);
    }, [lnAddress, lnAddressAmount, lnMinSats, lnMaxSats, balance, resolveAndGetQuote]);

    // ─── Pay Handler ──────────────────────────────────────────
    const handlePay = useCallback(async () => {
        if (!activeMintUrl || !quoteId) return;

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
        confirmSheetRef.current?.dismiss();

        try {
            const success = await biometricService.authenticateAsync(
                `Pay Lightning ₿${quoteAmount} sats`
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

    // ─── Amount Stage for LN Address ──────────────────────────
    const parsedAmountSats = parseInt(lnAddressAmount, 10) || 0;
    const isOverBalance = parsedAmountSats > balance;
    const isOverMax = parsedAmountSats > lnMaxSats;
    const isUnderMin = parsedAmountSats > 0 && parsedAmountSats < lnMinSats;
    const isValidAmount = parsedAmountSats > 0 && !isOverBalance && !isOverMax && !isUnderMin;

    return (
        <YStack flex={1} bg="$background" p="$4">
            {/* Step 1: Invoice Input */}
            {step === 'invoice' && (
                <InvoiceStage
                    invoice={invoice}
                    setInvoice={setInvoice}
                    onContinue={handleInvoiceContinue}
                    isLoading={isGettingQuote || isResolvingAddress}
                    error={error}
                />
            )}

            {/* Step 2: Amount Input (for Lightning addresses) */}
            {step === 'amount' && (
                <YStack flex={1} justify="space-between">
                    <YStack
                        width="100%"
                        height={280}
                        rounded="$4"
                        borderWidth={0.5}
                        borderColor="$borderColor"
                        justify="space-between"
                        bg="$color2"
                        items="center"
                    >
                        <XStack
                            width="100%"
                            p="$3"
                            items="center"
                            borderBottomWidth={1}
                            borderBottomColor="$color3"
                            justify="center"
                        >
                            <YStack items="center" gap="$0.5">
                                <Text fontWeight="600" fontSize="$3" color="$orange10">Paying to</Text>
                                <Text fontWeight="800" fontSize="$4">{lnAddress}</Text>
                            </YStack>
                        </XStack>

                        <YStack items="center" gap="$1">
                            <Text color="$gray10" fontSize="$3">How much to send?</Text>
                            <H1
                                fontWeight="400"
                                letterSpacing={-2}
                                py="$4"
                                color={isOverBalance || isOverMax ? "$red10" : isUnderMin ? "$orange10" : "$color"}
                            >
                                ₿{lnAddressAmount || '0'}
                            </H1>

                            {isOverBalance && (
                                <Text color="$red10" fontSize="$2">Exceeds available balance</Text>
                            )}
                            {isOverMax && !isOverBalance && (
                                <Text color="$red10" fontSize="$2">Maximum: {lnMaxSats} sats</Text>
                            )}
                            {isUnderMin && !isOverMax && (
                                <Text color="$orange10" fontSize="$2">Minimum: {lnMinSats} sats</Text>
                            )}
                        </YStack>

                        <XStack
                            width="100%"
                            p="$3"
                            borderTopWidth={1}
                            borderTopColor="$color3"
                            justify="space-between"
                            items="center"
                        >
                            <Text color="$gray10" fontWeight="400" fontSize="$3">
                                Range: {lnMinSats} – {lnMaxSats >= 1_000_000_000 ? '∞' : lnMaxSats.toLocaleString()} sats
                            </Text>
                            <Text color="$gray10" fontWeight="600" fontSize="$3">₿{balance}</Text>
                        </XStack>
                    </YStack>

                    {error && (
                        <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mt="$4">
                            <AlertCircle size={18} color="$red10" />
                            <Text color="$red10" fontSize="$3" flex={1}>{error}</Text>
                        </XStack>
                    )}

                    <NumericKeypad
                        showAmountDisplay={false}
                        value={lnAddressAmount}
                        onValueChange={setLnAddressAmount}
                        onConfirm={handleAmountContinue}
                        confirmLabel={isGettingQuote ? "Getting Quote..." : "Continue"}
                        confirmDisabled={!isValidAmount || isGettingQuote}
                        confirmIcon={isGettingQuote ? <Spinner size="small" /> : undefined}
                    />
                </YStack>
            )}

            {/* Step 3: Result */}
            {step === 'result' && (
                <MeltResultStage
                    status={status}
                    amount={quoteAmount}
                    feeReserve={feeReserve}
                    error={error}
                    onClose={handleClose}
                />
            )}

            {/* Confirmation Sheet */}
            <AppBottomSheet ref={confirmSheetRef}>
                <YStack p="$4" pt="$2" gap="$5">
                    <YStack items="center" gap="$2" pt="$2">
                        <Text fontSize="$6" fontWeight="800">Review Payment</Text>
                    </YStack>

                    <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                        {/* Invoice Amount */}
                        <XStack justify="space-between" items="center" py="$3" px="$4">
                            <XStack gap="$2" items="center">
                                <Zap size={16} color="$orange10" />
                                <Text fontSize="$4" color="$gray10" fontWeight="600">Invoice Amount</Text>
                            </XStack>
                            <YStack items="flex-end">
                                <Text fontWeight="800" fontSize="$5" color="$color">₿{quoteAmount} sats</Text>
                                <Text color="$gray10" fontSize="$3">{fiatValue}</Text>
                            </YStack>
                        </XStack>

                        {/* Fee Reserve */}
                        <XStack justify="space-between" items="center" py="$3" px="$4">
                            <XStack gap="$2" items="center">
                                <ShieldCheck size={16} color="$gray10" />
                                <Text fontSize="$4" color="$gray10" fontWeight="600">Fee Reserve</Text>
                            </XStack>
                            <Text fontSize="$5" fontWeight="800" color={feeReserve > 0 ? "$orange10" : "$green10"}>
                                {feeReserve > 0 ? `~${feeReserve} sats` : '0 sats'}
                            </Text>
                        </XStack>

                        {/* Total Deduction */}
                        <XStack justify="space-between" items="center" py="$3" px="$4" bg="$color3">
                            <XStack gap="$2" items="center">
                                <ArrowDownCircle size={16} color="$gray10" />
                                <Text fontSize="$4" color="$gray10" fontWeight="600">Total Deduction</Text>
                            </XStack>
                            <Text fontWeight="800" fontSize="$5" color="$red10">
                                -{totalCost} sats
                            </Text>
                        </XStack>

                        {/* Mint */}
                        <XStack justify="space-between" items="center" py="$3" px="$4">
                            <XStack gap="$2" items="center">
                                <Building2 size={16} color="$gray10" />
                                <Text fontSize="$4" color="$gray10" fontWeight="600">Mint</Text>
                            </XStack>
                            <XStack gap="$2" items="center">
                                {activeMint?.icon && (
                                    <View rounded="$10" overflow="hidden" width={20} height={20}>
                                        <Image source={{ uri: activeMint.icon }} width={20} height={20} />
                                    </View>
                                )}
                                <Text fontSize="$5" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 180 }}>{mintName}</Text>
                            </XStack>
                        </XStack>

                        {/* LN Address (if applicable) */}
                        {lnAddress && (
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <XStack gap="$2" items="center">
                                    <Zap size={16} color="$gray10" />
                                    <Text fontSize="$4" color="$gray10" fontWeight="600">Recipient</Text>
                                </XStack>
                                <Text fontSize="$5" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                                    {lnAddress}
                                </Text>
                            </XStack>
                        )}
                    </YStack>

                    {/* Balance Warning */}
                    {totalCost > balance && (
                        <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center">
                            <AlertCircle size={18} color="$red10" />
                            <Text color="$red10" fontSize="$3">Insufficient balance ({balance} sats available)</Text>
                        </XStack>
                    )}

                    <YStack gap="$3" pt="$2">
                        <Button
                            theme="accent"
                            size="$5"
                            fontWeight="800"
                            onPress={handleAuthenticate}
                            disabled={isPaying || totalCost > balance}
                            icon={isPaying ? <Spinner size="small" /> : <Zap size={20} />}
                        >
                            {isPaying ? 'Paying...' : 'Confirm & Pay'}
                        </Button>
                        <Button
                            chromeless
                            size="$4"
                            onPress={() => confirmSheetRef.current?.dismiss()}
                        >
                            Cancel
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>

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
