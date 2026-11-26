import { interactionCopy } from '~/services/feedback/interactionCopy';
import { usePendingPaymentPolling } from '~/shared/hooks/usePendingPaymentPolling';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import { OnchainTransactionRows } from '~/features/history/components/OnchainTransactionRows';
import { PaymentInfoHeader } from '~/shared/ui/PaymentInfoHeader';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { OnchainPaymentStatus } from '../OnchainPaymentStatus';
import { PaymentTechnicalDetails } from '../PaymentTechnicalDetails';
import type { ReceiptSnapshot } from '~/features/history/receiptDetails';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';

import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Text } from 'tamagui';

import { networkService } from '~/services/platform/networkService';
import { hapticService } from '~/services/platform/hapticService';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { quotesService, initService } from '~/services/wallet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';

import { useSettingsStore } from '~/state/settingsStore';
import { appLogger } from '~/shared/utils/appLogger';

export function OnchainMintFlow() {
  const router = useRouter();
  const [eventTime, setEventTime] = useState<number>();
  const toast = useAppToast();
  const { mintUrl: activeMintUrl, setMintUrl } = useFlowMint();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const { mints } = useWalletStore();
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();

  const [step, setStep] = useState<'confirm' | 'loading' | 'deposit' | 'success' | 'error'>(
    'confirm',
  );
  usePendingOperationToast({ active: step === 'loading', title: 'Preparing deposit address…' });
  const [quoteData, setQuoteData] = useState<{
    quote: string;
    request: string;
    privKey: string;
    pubKey: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  useFeedbackOwner(quoteData?.quote);
  const [copied, setCopied] = useState(false);

  // Payment status tracking
  const [isChecking, setIsChecking] = useState(false);
  const [isManualCheck, setIsManualCheck] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountIssued, setAmountIssued] = useState(0);
  const [txState, setTxState] = useState('UNPAID');
  const [quoteSnapshot, setQuoteSnapshot] = useState<ReceiptSnapshot>({});

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

  const mintDisplayName = useMemo(() => {
    if (!activeMintUrl) return 'Selected Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, activeMintUrl]);

  const [creating, setCreating] = useState(false);
  // Issue an address only after the mint has been reviewed.
  useEffect(() => {
    if (!creating) return;
    if (!activeMintUrl) {
      setErrorMsg('No active mint selected');
      setStep('error');
      return;
    }

    let isMounted = true;

    const initFlow = async () => {
      const offline = await networkService.isOffline();
      if (offline) {
        if (isMounted) {
          setErrorMsg('You are offline. Please check your internet connection.');
          setStep('error');
        }
        return;
      }

      try {
        const data = await quotesService.createOnchainMintQuote(activeMintUrl);
        if (isMounted) {
          setQuoteData(data);
          setStep('deposit');

          // Save quote details to local history database
          try {
            const repo = initService.getRepo();
            await (repo.historyRepository as any).addHistoryEntry({
              mintUrl: activeMintUrl,
              unit: 'sat',
              createdAt: Date.now(),
              type: 'mint',
              amount: 0, // initially 0
              quoteId: data.quote,
              state: 'pending',
              paymentRequest: data.request, // BTC address as paymentRequest
              metadata: {
                via: 'onchain',
                privKey: data.privKey,
                pubKey: data.pubKey,
                address: data.request,
              },
            });
          } catch (dbErr) {
            appLogger.warn(
              '[OnchainMintFlow] Failed to save on-chain quote to history:',
              dbErr,
              'mint_quote',
            );
          }
        }
      } catch (err: any) {
        if (isMounted) {
          appLogger.error('[OnchainMintFlow] Failed to create quote:', err, 'mint_quote');
          setErrorMsg(err.message || 'Failed to request deposit address');
          setStep('error');
        }
      }
    };

    initFlow();

    return () => {
      isMounted = false;
    };
  }, [activeMintUrl, creating]);

  // Handle copying Bitcoin address
  const handleCopy = async () => {
    if (!quoteData) return;
    if (!(await copyWithFeedback(quoteData.request, toast))) return;
    hapticService.acknowledge();
    setCopied(true);
    toast.showFeedback(interactionCopy.addressCopiedToClipboard);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manual check and redeem handler
  const handleCheckPayment = useCallback(
    async (showToast = true) => {
      if (!activeMintUrl || !quoteData || isChecking) return;

      setIsChecking(true);
      if (showToast) setIsManualCheck(true);
      try {
        const status = await quotesService.checkOnchainMintQuote(activeMintUrl, quoteData.quote);
        setAmountPaid(status.amount_paid);
        setAmountIssued(status.amount_issued);
        setTxState(status.state);
        setQuoteSnapshot({
          request: quoteData.request,
          state: status.state,
          expiry: status.expiry,
          amountPaid: status.amount_paid,
          amountIssued: status.amount_issued,
        });

        const delta = status.amount_paid - status.amount_issued;
        if (delta > 0) {
          await quotesService.redeemOnchainMintQuote(
            activeMintUrl,
            quoteData.quote,
            quoteData.privKey,
          );

          // Update history entry state in DB
          try {
            const repo = initService.getRepo();
            await (repo.historyRepository as any).updateHistoryMintEntry(
              activeMintUrl,
              quoteData.quote,
              'paid',
              status.amount_paid,
            );
          } catch (dbErr) {
            appLogger.warn(
              '[OnchainMintFlow] Failed to update history state to paid:',
              dbErr,
              'mint_quote',
            );
          }

          setEventTime(Date.now());
          setStep('success');
          refreshBalance();
        } else {
          if (showToast) {
            toast.showFeedback(interactionCopy.noNewPaymentsDetectedYet);
          }
        }
      } catch (err: any) {
        appLogger.error('[OnchainMintFlow] Check payment error:', err, 'mint_quote');
        if (showToast) {
          toast.showFeedback(interactionCopy.couldNotCheckPaymentStatusPleaseTry);
        }
      } finally {
        setIsChecking(false);
        if (showToast) setIsManualCheck(false);
      }
    },
    [activeMintUrl, quoteData, isChecking, refreshBalance, toast],
  );

  usePendingPaymentPolling(() => handleCheckPayment(false), step === 'deposit' && !!quoteData);

  const technicalDetails = quoteData && (
    <PaymentTechnicalDetails
      entry={{
        id: '',
        type: 'mint',
        amount: amountPaid,
        unit: 'sat',
        mintUrl: activeMintUrl || '',
        createdAt: eventTime || 0,
        quoteId: quoteData.quote,
        paymentRequest: quoteData.request,
        state: step === 'success' ? 'issued' : txState,
        metadata: { via: 'onchain', address: quoteData.request },
      }}
      snapshot={quoteSnapshot}
    />
  );

  // Render loading state
  if (step === 'confirm')
    return (
      <>
        <PaymentInfoHeader
          infoTopic="onchain-top-up"
          title="Confirm top-up"
          navigationAction="close"
        />
        <PaymentStageLayout
          inset={false}
          hero={
            <>
              <Text fontSize={13} fontWeight="500" color="$gray10">
                You're adding
              </Text>
              <Text fontSize={25} fontWeight="500" color="$color" textAlign="center">
                Bitcoin on-chain
              </Text>
            </>
          }
          footer={
            <AppButton
              haptic
              size="large"
              fullWidth
              disabled={!activeMintUrl}
              onPress={() => {
                setStep('loading');
                setCreating(true);
              }}
            >
              Show address
            </AppButton>
          }
        >
          <ListTable compact>
            <PaymentMintRow
              mintUrl={activeMintUrl || ''}
              onSelect={setMintUrl}
              method="mint-onchain"
            />
            <ListTableRow label="Method" value="On-chain deposit" />
          </ListTable>
        </PaymentStageLayout>
      </>
    );

  if (step === 'loading') {
    return (
      <OnchainPaymentStatus
        status="processing"
        direction="deposit"
        mint={mintDisplayName}
        title="Preparing deposit"
        onClose={() => router.back()}
      />
    );
  }

  // Render error state
  if (step === 'error')
    return (
      <OnchainPaymentStatus
        status="error"
        direction="deposit"
        amount={amountIssued || amountPaid}
        mint={mintDisplayName}
        address={quoteData?.request}
        error={errorMsg}
        technicalDetails={technicalDetails}
        onClose={() => router.back()}
      />
    );

  // Render success state
  if (step === 'success')
    return (
      <OnchainPaymentStatus
        status="success"
        direction="deposit"
        amount={amountIssued || amountPaid}
        mint={mintDisplayName}
        address={quoteData?.request}
        time={eventTime}
        technicalDetails={technicalDetails}
        onClose={() => router.back()}
        transactionDetails={
          <OnchainTransactionRows direction="deposit" address={quoteData?.request || ''} />
        }
      />
    );

  // Render deposit state (displays Bitcoin address and QR code)
  return (
    <PendingOnchainLayout
      navigationAction="close"
      direction="deposit"
      amount={amountPaid}
      address={quoteData?.request || ''}
      mint={mintDisplayName}
      onRefresh={() => handleCheckPayment(true)}
      checking={isChecking}
      onClose={() => router.back()}
      inset={false}
      technicalDetails={technicalDetails}
      transactionDetails={
        <OnchainTransactionRows direction="deposit" address={quoteData?.request || ''} pending />
      }
    />
  );
}
