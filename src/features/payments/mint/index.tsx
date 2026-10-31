import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { Text, YStack } from 'tamagui';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { AmountStage } from '~/features/payments/mint/AmountStage';
import { ConfirmStage } from '~/features/payments/mint/ConfirmStage';
import { PaymentStage } from '~/features/payments/mint/PaymentStage';
import { ResultStage } from '~/features/payments/mint/ResultStage';
import { OnchainMintFlow } from '~/features/payments/mint/OnchainMintFlow';
import { useWalletStore } from '~/state/walletStore';
import { eventService, quotesService, initService } from '~/services/wallet';
import { networkService } from '~/services/platform/networkService';
import { nostrService } from '~/services/wallet/nostrService';
import { decodeNostrPublicKey } from '~/services/api/nostrProfileService';
import { normalizeNpub } from '~/shared/utils/nostr';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';

type MintStep = 'amount' | 'confirm' | 'payment' | 'result';
type MintResultStatus = 'success' | 'error' | 'cancelled';

interface MintQuoteData {
  quoteId: string;
  invoice: string;
  expiry?: number;
}

export default function MintScreen() {
  const router = useRouter();
  const { mode, requestTo, requestName } = useLocalSearchParams<{
    mode?: string;
    requestTo?: string;
    requestName?: string;
  }>();
  const requestRecipient =
    typeof requestTo === 'string' && decodeNostrPublicKey(requestTo)
      ? normalizeNpub(requestTo)
      : undefined;
  const { mintUrl: activeMintUrl, setMintUrl } = useFlowMint();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  if (mode === 'onchain') {
    return (
      <YStack flex={1} bg="$background" px="$4">
        <Stack.Screen options={{ title: 'On-Chain Recieve' }} />
        <OnchainMintFlow />
      </YStack>
    );
  }

  const [step, setStep] = useState<MintStep>('amount');
  const [amount, setAmount] = useState('0');
  const [status, setStatus] = useState<MintResultStatus>('success');
  const [quoteData, setQuoteData] = useState<MintQuoteData | null>(null);
  useFeedbackOwner(quoteData?.quoteId);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const createLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [requestQueued, setRequestQueued] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const requestLock = useRef(false);
  const queuedInvoice = useRef<string | null>(null);
  useSettingsBusy(requestSending);

  const sendInvoiceRequest = async () => {
    if (
      !requestRecipient ||
      !quoteData ||
      requestLock.current ||
      queuedInvoice.current === quoteData.invoice
    )
      return;
    if (quoteData.expiry && quoteData.expiry <= Date.now() / 1000) {
      setRequestError('Invoice expired. Create a new request.');
      return;
    }
    requestLock.current = true;
    setRequestSending(true);
    setRequestError('');
    try {
      await nostrService.sendChat(requestRecipient, quoteData.invoice, () => {
        queuedInvoice.current = quoteData.invoice;
        setRequestQueued(true);
      });
    } catch {
      setRequestError(
        queuedInvoice.current === quoteData.invoice
          ? 'Request saved but delivery failed. Open the request in the conversation to retry.'
          : 'Could not send the request. Try again when online.',
      );
    } finally {
      requestLock.current = false;
      setRequestSending(false);
    }
  };

  // Listen for mint quote redeemed event
  useEffect(() => {
    if (!quoteData) return;

    const handleRedeemed = (payload: any) => {
      console.log('[MintScreen] Mint quote redeemed');
      if (payload.quoteId === quoteData.quoteId) {
        setStatus('success');
        setStep('result');
        refreshBalance();
      }
    };

    const unsub = eventService.on('mint-quote:redeemed', handleRedeemed);
    return () => {
      unsub();
    };
  }, [quoteData, refreshBalance]);

  const handleCreateQuote = useCallback(async () => {
    if (createLock.current) return;
    if (!activeMintUrl) {
      setError('No active mint selected');
      return;
    }

    createLock.current = true;
    setIsCreatingQuote(true);
    setError(null);

    try {
      if (requestTo && !requestRecipient) throw new Error('Invalid request recipient.');
      if (await networkService.isOffline())
        throw new Error('You are offline. Please check your internet connection.');
      const amountSats = parseInt(amount, 10);
      if (isNaN(amountSats) || amountSats <= 0) {
        throw new Error('Invalid amount');
      }

      const quote = await quotesService.createMintQuote(activeMintUrl, amountSats);

      setQuoteData({
        quoteId: quote.quote,
        invoice: quote.request,
        expiry: quote.expiry,
      });
      setStep('payment');
    } catch (err: any) {
      console.error('[MintScreen] Failed to create mint quote:', err);
      setError(err.message || 'Failed to create invoice');
      setStatus('error');
      setStep('result');
    } finally {
      createLock.current = false;
      setIsCreatingQuote(false);
    }
  }, [activeMintUrl, amount, requestTo, requestRecipient]);

  const handleNext = () => {
    if (step === 'amount') setStep('confirm');
    else if (step === 'confirm') {
      handleCreateQuote();
    }
  };

  const handleBack = () => {
    if (step === 'confirm') setStep('amount');
    else router.back();
  };

  const handleCancel = async () => {
    if (requestLock.current) return;
    setStatus('cancelled');
    setStep('result');
    if (quoteData && activeMintUrl) {
      try {
        const repo = initService.getRepo();
        if (repo?.historyRepository) {
          await (repo.historyRepository as any).updateHistoryMintEntry(
            activeMintUrl,
            quoteData.quoteId,
            'failed',
          );
          console.log(
            '[MintScreen] Marked cancelled mint quote in history as failed:',
            quoteData.quoteId,
          );
        }
      } catch (e) {
        console.warn('[MintScreen] Failed to mark cancelled mint quote in history:', e);
      }
    }
  };

  const handlePaid = async () => {
    if (quoteData && activeMintUrl) {
      try {
        await quotesService.redeemMintQuote(activeMintUrl, quoteData.quoteId);
        setStatus('success');
        refreshBalance();
        setStep('result');
      } catch (err: any) {
        console.log('[MintScreen] Manual redeem attempt failed:', err.message);
        throw err;
      }
    }
  };

  const handleClose = () => {
    if (requestLock.current) return;
    router.back();
    InteractionManager.runAfterInteractions(() => refreshBalance());
  };

  return (
    <YStack flex={1} bg="$background" px="$4">
      <Stack.Screen />
      {(step === 'amount' || step === 'payment') && (
        <PaymentFlowHeader
          title={
            requestRecipient
              ? 'Request Lightning'
              : step === 'payment'
                ? 'Pay invoice'
                : 'Mint Ecash'
          }
          navigationAction="close"
          onBack={handleClose}
          disabled={isCreatingQuote || requestSending}
        />
      )}
      {requestRecipient && step !== 'result' && (
        <Text color="$gray10" fontSize={14} textAlign="center" mb="$3">
          Request from{' '}
          {requestName || `${requestRecipient.slice(0, 10)}…${requestRecipient.slice(-6)}`}
        </Text>
      )}
      {step === 'amount' && (
        <AmountStage
          mintUrl={activeMintUrl}
          onMintChange={setMintUrl}
          amount={amount}
          setAmount={setAmount}
          onContinue={handleNext}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStage
          onMintChange={setMintUrl}
          amount={amount}
          mintUrl={activeMintUrl || ''}
          isLoading={isCreatingQuote}
          onConfirm={handleNext}
          onBack={handleBack}
        />
      )}

      {step === 'payment' && quoteData && (
        <PaymentStage
          amount={amount}
          invoice={quoteData.invoice}
          quoteId={quoteData.quoteId}
          mintUrl={activeMintUrl || ''}
          expiry={quoteData.expiry}
          onPaid={handlePaid}
          onCancel={handleCancel}
          requestDelivery={
            requestRecipient
              ? {
                  onSend: sendInvoiceRequest,
                  onView: handleClose,
                  sending: requestSending,
                  queued: requestQueued,
                  error: requestError,
                }
              : undefined
          }
        />
      )}

      {step === 'result' && (
        <ResultStage
          invoice={quoteData?.invoice}
          quoteId={quoteData?.quoteId}
          status={status}
          amount={amount}
          mintUrl={activeMintUrl || undefined}
          error={error}
          onClose={handleClose}
        />
      )}
    </YStack>
  );
}
