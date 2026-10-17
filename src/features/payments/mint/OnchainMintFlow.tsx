import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { useFlowMint } from '~/shared/hooks/useFlowMint';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { Landmark } from '@tamagui/lucide-icons';

import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { YStack, Text, Paragraph } from 'tamagui';

import * as Clipboard from 'expo-clipboard';
import { networkService } from '~/services/platform/networkService';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { quotesService, initService } from '~/services/wallet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';

import { useSettingsStore } from '~/state/settingsStore';

export function OnchainMintFlow() {
  const router = useRouter();
  const [eventTime, setEventTime] = useState<number>();
  const toast = useToastController();
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
  const [copied, setCopied] = useState(false);

  // Payment status tracking
  const [isChecking, setIsChecking] = useState(false);
  const [isManualCheck, setIsManualCheck] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountIssued, setAmountIssued] = useState(0);
  const [txState, setTxState] = useState('UNPAID');

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
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
            console.log(
              '[OnchainMintFlow] Saved on-chain quote in local database history:',
              data.quote,
            );
          } catch (dbErr) {
            console.warn('[OnchainMintFlow] Failed to save on-chain quote to history:', dbErr);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[OnchainMintFlow] Failed to create quote:', err);
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
    await Clipboard.setStringAsync(quoteData.request);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.show('Address copied to clipboard', { kind: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Manual check and redeem handler
  const handleCheckPayment = useCallback(
    async (showToast = true) => {
      if (!activeMintUrl || !quoteData || isChecking) return;

      setIsChecking(true);
      if (showToast) setIsManualCheck(true);
      try {
        console.log('[OnchainMintFlow] Checking deposit status for:', quoteData.quote);
        const status = await quotesService.checkOnchainMintQuote(activeMintUrl, quoteData.quote);
        setAmountPaid(status.amount_paid);
        setAmountIssued(status.amount_issued);
        setTxState(status.state);

        const delta = status.amount_paid - status.amount_issued;
        if (delta > 0) {
          console.log('[OnchainMintFlow] Payment detected, redeeming...', delta, 'sats');
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
            console.warn('[OnchainMintFlow] Failed to update history state to paid:', dbErr);
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setEventTime(Date.now());
          setStep('success');
          refreshBalance();
        } else {
          if (showToast) {
            toast.show('No new payments detected yet.', { kind: 'info' });
          }
        }
      } catch (err: any) {
        console.error('[OnchainMintFlow] Check payment error:', err);
        if (showToast) {
          toast.show('Error checking payment: ' + (err.message || 'Failed to check status'), {
            kind: 'error',
          });
        }
      } finally {
        setIsChecking(false);
        if (showToast) setIsManualCheck(false);
      }
    },
    [activeMintUrl, quoteData, isChecking, refreshBalance, toast],
  );

  // Periodically poll for payment status
  useEffect(() => {
    if (step !== 'deposit' || !quoteData) return;

    const interval = setInterval(() => {
      handleCheckPayment(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [step, quoteData, handleCheckPayment]);

  // Render loading state
  if (step === 'confirm')
    return (
      <>
        <PaymentFlowHeader title="Confirm top-up" />
        <PaymentStageLayout
          inset={false}
          hero={
            <>
              <Text fontSize={14} fontWeight="500" color="$gray10">
                You're adding
              </Text>
              <Text fontSize={28} fontWeight="500" color="$color" textAlign="center">
                Bitcoin on-chain
              </Text>
            </>
          }
          footer={
            <AppButton
              size="large"
              fullWidth
              disabled={!activeMintUrl}
              onPress={() => {
                setStep('loading');
                setCreating(true);
              }}
            >
              Create deposit address
            </AppButton>
          }
        >
          <ListTable>
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
      <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
        <Landmark size={48} color="$accent10" />
        <Paragraph color="$gray10">On-chain deposit</Paragraph>
        <Text fontWeight="600">{mintDisplayName}</Text>
        <Paragraph color="$gray10" textAlign="center">
          Your deposit address will appear here.
        </Paragraph>
      </YStack>
    );
  }

  // Render error state
  if (step === 'error')
    return (
      <PaymentReceipt
        status="error"
        inset={false}
        title="Deposit not completed"
        amount={amountIssued || amountPaid}
        mintUrl={activeMintUrl || undefined}
        completed={false}
        error={errorMsg}
        onClose={() => router.back()}
      />
    );

  // Render success state
  if (step === 'success')
    return (
      <PaymentReceipt
        inset={false}
        title="Funds added"
        amount={amountIssued || amountPaid}
        mintUrl={activeMintUrl || undefined}
        time={eventTime}
        completed
        onClose={() => router.back()}
      />
    );

  // Render deposit state (displays Bitcoin address and QR code)
  return (
    <PendingOnchainLayout
      direction="deposit"
      amount={amountPaid}
      address={quoteData?.request || ''}
      mint={mintDisplayName}
      onRefresh={() => handleCheckPayment(true)}
      checking={isChecking}
      onClose={() => router.back()}
      inset={false}
    />
  );
}
