import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentConfirmation } from '~/services/wallet/paymentConfirmation';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { LightningPayment } from '~/services/wallet/lightningPayment';
import { InteractionManager } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { InvoiceStage } from '~/features/payments/melt/InvoiceStage';
import { MeltResultStage } from '~/features/payments/melt/ResultStage';
import { OnchainMeltFlow } from '~/features/payments/melt/OnchainMeltFlow';

import {
  detectLightningInputType,
  normalizeLightningInput,
  requestInvoiceFromLnurl,
  getLnurlPayParams,
} from '~/services/api/lnurlService';
import { biometricService } from '~/services/platform/biometricService';
import { networkService } from '~/services/platform/networkService';
import * as Haptics from 'expo-haptics';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { Text, YStack } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/wallet/currencyService';

type MeltStep = 'invoice' | 'confirm' | 'result';

export default function MeltScreen() {
  const { mode, lightningAddress, source } = useLocalSearchParams<{
    mode?: string;
    lightningAddress?: string;
    source?: string;
  }>();

  if (mode === 'onchain') {
    return (
      <YStack flex={1} bg="$background" px="$4">
        <Stack.Screen options={{ title: 'On-Chain Send' }} />
        <OnchainMeltFlow />
      </YStack>
    );
  }

  const [step, setStep] = useState<MeltStep>('invoice');
  const [invoice, setInvoice] = useState(() =>
    typeof lightningAddress === 'string' && detectLightningInputType(lightningAddress) === 'address'
      ? normalizeLightningInput(lightningAddress)
      : '',
  );
  const [resolvedInvoice, setResolvedInvoice] = useState<string | null>(null);
  const [lnAddress, setLnAddress] = useState<string | null>(null);
  const [lnAddressAmount, setLnAddressAmount] = useState('0');
  const [status, setStatus] = useState<'success' | 'error' | 'pending' | 'unresolved'>('success');
  const [error, setError] = useState<string | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isManualQuote, setIsManualQuote] = useState(false);
  usePendingOperationToast({
    active: isGettingQuote && !isManualQuote,
    title: 'Preparing Lightning payment…',
  });
  const [resultTime, setResultTime] = useState<number>();
  const [quoteAmount, setQuoteAmount] = useState(0);
  const [feeReserve, setFeeReserve] = useState(0);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  useFeedbackOwner(quoteId);
  useSettingsBusy(isPaying);
  const router = useRouter();
  const paymentRef = useRef<LightningPayment | null>(null);
  const payLock = useRef(false);
  const authLock = useRef(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const confirmation = useRef(new PaymentConfirmation());
  const quoteGeneration = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;

  const paymentFor = (mintUrl: string, bolt11: string) => {
    const current = paymentRef.current;
    if (current?.mintUrl === mintUrl && current.invoice === bolt11) return current;
    if (current) void current.dispose().catch(() => {});
    return (paymentRef.current = new LightningPayment(mintUrl, bolt11));
  };

  useEffect(
    () => () => {
      void paymentRef.current?.dispose().catch(() => {});
    },
    [],
  );

  const { mintUrl: activeMintUrl, setMintUrl, balance } = useFlowMint();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const mints = useWalletStore((s) => s.mints);
  const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  // Fixed invoices go straight to review once their mint quote is ready.
  useEffect(() => {
    const generation = ++quoteGeneration.current;
    const reviewing = stepRef.current === 'confirm';
    const previousInvoice = resolvedInvoice;
    setIsGettingQuote(false);
    setError(null);
    setQuoteId(null);
    if (!reviewing) setQuoteAmount(0);
    setFeeReserve(0);
    if (!reviewing) setResolvedInvoice(null);
    if (!reviewing) setStep('invoice');
    const old = paymentRef.current;
    paymentRef.current = null;
    const release = old
      ? old.dispose().then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);
    const inputType = detectLightningInputType(invoice);
    const cleaned = inputType === 'unknown' ? invoice.trim() : normalizeLightningInput(invoice);
    if (!cleaned) {
      setLnAddressAmount('0');
      return;
    }

    const previewInvoice = inputType === 'bolt11' ? cleaned : reviewing ? previousInvoice : null;
    if (inputType === 'bolt11') setLnAddress(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (previewInvoice && activeMintUrl) {
      setIsGettingQuote(true);
      setError(null);
      let payment: LightningPayment | undefined;
      // Avoid preparing a replacement operation for every character while typing.
      timer = setTimeout(() => {
        release
          .then(async (released) => {
            if (generation !== quoteGeneration.current) throw new Error('Invoice changed');
            if (!released) throw new Error('Could not release the previous payment. Try again.');
            if (await networkService.isOffline())
              throw new Error('You are offline. Please check your internet connection.');
            if (generation !== quoteGeneration.current) throw new Error('Invoice changed');
            payment = paymentFor(activeMintUrl, previewInvoice);
            return payment.preview();
          })
          .then((quote) => {
            if (generation !== quoteGeneration.current) return;
            if (quote.expiry && quote.expiry <= Date.now() / 1000)
              throw new Error('Invoice or quote expired. Ask for a new invoice.');
            if (!Number.isFinite(quote.amount) || quote.amount <= 0)
              throw new Error(
                'This invoice needs a payable amount. Ask for an invoice with an amount.',
              );
            console.log('[MeltScreen] Auto-fetched melt quote amount:', quote.amount);
            setQuoteAmount(quote.amount);
            setFeeReserve(quote.fee_reserve);
            setQuoteId(quote.quote);
            setLnAddressAmount(quote.amount.toString());
            setStep('confirm');
          })
          .catch(async (err) => {
            if (generation !== quoteGeneration.current) return;
            await payment?.dispose().catch(() => {});
            if (generation !== quoteGeneration.current) return;
            if (paymentRef.current === payment) paymentRef.current = null;
            setError(err.message || 'Failed to parse invoice amount');
          })
          .finally(() => {
            if (generation === quoteGeneration.current) setIsGettingQuote(false);
          });
      }, 300);
    }
    return () => {
      clearTimeout(timer);
      ++quoteGeneration.current;
    };
  }, [invoice, activeMintUrl]);

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    return mints.find((m) => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
  }, [mints, activeMintUrl]);

  const mintName =
    activeMint?.nickname ||
    activeMint?.name ||
    activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
    'Unknown Mint';

  const totalCost = quoteAmount + feeReserve;

  const fiatValue = useMemo(() => {
    if (secondaryCurrency === 'NONE') return '';

    if (!btcData?.price) return '...';
    const cur = SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency);
    const symbol = cur?.symbol || '$';
    const val = currencyService.convertSatsToCurrency(quoteAmount, btcData.price);
    return secondaryCurrency === 'AED' || secondaryCurrency === 'KWD'
      ? currencyService.formatValue(val, secondaryCurrency)
      : `${symbol}${val.toFixed(2)}`;
  }, [quoteAmount, btcData?.price, secondaryCurrency]);

  const totalFiatValue = useMemo(() => {
    if (secondaryCurrency === 'NONE') return '';

    if (!btcData?.price) return '...';
    const cur = SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency);
    const symbol = cur?.symbol || '$';
    const val = currencyService.convertSatsToCurrency(totalCost, btcData.price);
    return secondaryCurrency === 'AED' || secondaryCurrency === 'KWD'
      ? currencyService.formatValue(val, secondaryCurrency)
      : `${symbol}${val.toFixed(2)}`;
  }, [totalCost, btcData?.price, secondaryCurrency]);

  // ─── Invoice Stage: Continue Handler ──────────────────────
  const handleInvoiceContinue = useCallback(async () => {
    if (isManualQuote || isGettingQuote) return;
    setIsManualQuote(true);
    try {
      if (!activeMintUrl) {
        setError('No active mint selected');
        return;
      }

      const offline = await networkService.isOffline();
      if (offline) {
        setError('You are offline. Please check your internet connection.');
        return;
      }

      let cleaned = invoice.trim();
      if (!cleaned) {
        setError('Please enter a Lightning invoice or address');
        return;
      }

      const inputType = detectLightningInputType(cleaned);
      if (inputType !== 'unknown') cleaned = normalizeLightningInput(cleaned);
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
            setError(`Minimum amount is ${minSats} sat`);
            setIsResolvingAddress(false);
            return;
          }

          if (amountSats > maxSats) {
            setError(`Maximum amount is ${maxSats} sat`);
            setIsResolvingAddress(false);
            return;
          }

          if (amountSats > balance) {
            setError('Insufficient balance');
            setIsResolvingAddress(false);
            return;
          }

          console.log(`[MeltScreen] LN address resolved: amount=${amountSats} sat`);
          await resolveAndGetQuote(cleaned, amountSats);
        } catch (err: any) {
          console.error('[MeltScreen] LN address resolution failed:', err);
          setError(err.message || 'Failed to resolve Lightning address');
        } finally {
          setIsResolvingAddress(false);
        }
      } else {
        setError(
          'Invalid input. Enter a Lightning invoice (lnbc...) or Lightning address (user@domain.com)',
        );
      }
    } finally {
      setIsManualQuote(false);
    }
  }, [activeMintUrl, invoice, lnAddressAmount, balance, isManualQuote, isGettingQuote]);

  // ─── Resolve LN address to invoice and get quote ──────────
  const resolveAndGetQuote = useCallback(
    async (address: string, amountSats: number) => {
      const generation = quoteGeneration.current;
      setIsGettingQuote(true);
      setError(null);

      try {
        console.log(`[MeltScreen] Resolving ${address} for ${amountSats} sat...`);
        const bolt11 = await requestInvoiceFromLnurl(address, amountSats);
        if (generation !== quoteGeneration.current) return;
        setResolvedInvoice(bolt11);
        console.log('[MeltScreen] Lightning address resolved');
        await getQuoteForInvoice(bolt11);
      } catch (err: any) {
        console.error('[MeltScreen] Resolution failed:', err);
        setError(err.message || 'Failed to get invoice from Lightning address');
        setIsGettingQuote(false);
      }
    },
    [activeMintUrl, balance],
  );

  // ─── Get melt quote for a bolt11 invoice ──────────────────
  const getQuoteForInvoice = useCallback(
    async (bolt11: string) => {
      if (!activeMintUrl) return;
      const generation = quoteGeneration.current;

      const offline = await networkService.isOffline();
      if (generation !== quoteGeneration.current) return;
      if (offline) {
        setError('You are offline. Please check your internet connection.');
        return;
      }

      setIsGettingQuote(true);
      setError(null);

      try {
        console.log('[MeltScreen] Getting melt quote from', activeMintUrl);
        const payment = paymentFor(activeMintUrl, bolt11);
        const quote = await payment.preview();
        if (generation !== quoteGeneration.current || paymentRef.current !== payment) return;
        if (quote.expiry && quote.expiry <= Date.now() / 1000) {
          await payment.dispose();
          paymentRef.current = null;
          setQuoteId(null);
          throw new Error('Quote expired. Continue again to review a fresh quote.');
        }
        if (!Number.isFinite(quote.amount) || quote.amount <= 0) {
          await payment.dispose();
          paymentRef.current = null;
          setQuoteId(null);
          throw new Error(
            'This invoice needs a payable amount. Ask for an invoice with an amount.',
          );
        }
        setQuoteAmount(quote.amount);
        setFeeReserve(quote.fee_reserve);
        setQuoteId(quote.quote);
        setStep('confirm');

        // Check balance sufficiency
        if (quote.amount + quote.fee_reserve > balance) {
          setError(
            `Insufficient balance. Need ${quote.amount + quote.fee_reserve} sat (${quote.amount} + ${quote.fee_reserve} fee reserve), have ${balance} sat.`,
          );
          setIsGettingQuote(false);
          return;
        }

        // Go to confirm step
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setStep('confirm');
      } catch (err: any) {
        if (generation !== quoteGeneration.current) return;
        console.error('[MeltScreen] Quote failed:', err);
        setError(err.message || 'Failed to get melt quote');
      } finally {
        if (generation === quoteGeneration.current) setIsGettingQuote(false);
      }
    },
    [activeMintUrl, balance],
  );

  // ─── Pay Handler ──────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!activeMintUrl || !quoteId || payLock.current) return;
    const payment = paymentRef.current;
    if (!payment || payment.mintUrl !== activeMintUrl) return;
    payLock.current = true;

    const offline = await networkService.isOffline();
    if (offline) {
      setError('You are offline. Please check your internet connection.');
      payLock.current = false;
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      console.log('[MeltScreen] Paying melt quote:', quoteId);
      const result = await payment.pay();
      if (paymentRef.current !== payment) return;
      setResultTime(Date.now());
      setStatus(result === 'paid' ? 'success' : result);
      refreshBalance();
      setStep('result');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Lightning payment failed');
      setStatus('error');
      setStep('result');
    } finally {
      setIsPaying(false);
      payLock.current = false;
    }
  }, [activeMintUrl, quoteId, refreshBalance]);

  // ─── Auth Handler ─────────────────────────────────────────
  const handleAuthenticate = async () => {
    if (authLock.current || payLock.current) return;
    authLock.current = true;
    setIsAuthenticating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const success = await confirmation.current.confirm({
        biometricEnabled: useSettingsStore.getState().biometricEnabled,
        authenticate: () =>
          biometricService.authenticateAsync(
            `Pay Lightning ${currencyService.formatSats(quoteAmount)}`,
          ),
        execute: handlePay,
      });

      if (!success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      console.error('[MeltScreen] Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      authLock.current = false;
      setIsAuthenticating(false);
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
          <PaymentFlowHeader title="Pay Lightning" navigationAction="close" onBack={handleClose} />
          <InvoiceStage
            mintUrl={activeMintUrl}
            onMintChange={setMintUrl}
            amount={lnAddressAmount}
            setAmount={setLnAddressAmount}
            invoice={invoice}
            setInvoice={setInvoice}
            onContinue={handleInvoiceContinue}
            balance={balance}
            isLoading={isResolvingAddress || isManualQuote || isGettingQuote}
            disabled={isGettingQuote || isManualQuote}
            error={error}
            amountPresets={source === 'support' ? [1000, 5000, 10000] : undefined}
          />
        </YStack>
      )}

      {/* Step 2: Confirm */}
      {step === 'confirm' && (
        <>
          <PaymentFlowHeader
            title="Confirm payment"
            disabled={isPaying || isAuthenticating}
            onBack={async () => {
              ++quoteGeneration.current;
              await paymentRef.current?.dispose();
              paymentRef.current = null;
              setQuoteId(null);
              setIsGettingQuote(false);
              setStep('invoice');
            }}
          />
          <PaymentStageLayout
            disabled={isPaying || isAuthenticating}
            hero={<PaymentAmount amount={quoteAmount} size="prominent" label="You're paying" />}
            footer={
              <AppButton
                variant="default"
                emphasis="primary"
                size="large"
                fullWidth
                loading={isPaying}
                loadingText="Paying Lightning invoice…"
                onPress={handleAuthenticate}
                disabled={
                  isPaying || isAuthenticating || isGettingQuote || !quoteId || totalCost > balance
                }
              >
                {isPaying ? 'Paying…' : 'Pay'}
              </AppButton>
            }
          >
            <ListTable compact>
              <PaymentMintRow
                method="melt-lightning"
                mintUrl={activeMintUrl || ''}
                onSelect={setMintUrl}
                disabled={isPaying || isAuthenticating}
              />
              <ListTableRow label="Method" value="Lightning" />
              <ListTableRow
                label="Maximum fee"
                value={isGettingQuote ? 'Calculating…' : currencyService.formatSats(feeReserve)}
              />
              <ListTableRow label="Maximum total" value={currencyService.formatSats(totalCost)} />
              {lnAddress && <ListTableRow label="Recipient" value={lnAddress} />}
            </ListTable>
            {error && (
              <Text color="$red10" p="$3">
                {error}
              </Text>
            )}
            {totalCost > balance && !error && (
              <Text color="$red10" p="$3">
                Insufficient balance ({balance} sat available)
              </Text>
            )}
          </PaymentStageLayout>
        </>
      )}

      {/* Step 3: Result */}
      {step === 'result' && (
        <YStack flex={1}>
          <MeltResultStage
            status={status}
            amount={quoteAmount}
            feeReserve={feeReserve}
            mintUrl={activeMintUrl || undefined}
            time={resultTime}
            error={error}
            onClose={handleClose}
            onRefresh={async () => {
              const result = await paymentRef.current?.refresh();
              if (result) {
                if (result === 'paid' && status !== 'success') setResultTime(Date.now());
                setStatus(result === 'paid' ? 'success' : result);
              }
              refreshBalance();
            }}
          />
        </YStack>
      )}
    </YStack>
  );
}
