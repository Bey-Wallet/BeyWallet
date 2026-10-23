import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack } from 'tamagui';

import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/state/walletStore';
import { walletService, quotesService, initService } from '~/services/wallet';
import { currencyService } from '~/services/wallet/currencyService';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';

import { AmountStage } from '~/features/payments/swap/AmountStage';
import { ResultStage } from '~/features/payments/swap/ResultStage';

type SwapStep = 'amount' | 'confirm' | 'result';

export default function SwapScreen() {
  const router = useRouter();
  const mints = useWalletStore((s) => s.mints);
  const balances = useWalletStore((s) => s.balances);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  const [step, setStep] = useState<SwapStep>('amount');
  const [amount, setAmount] = useState('0');

  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);

  // We auto-select the first mint with balance as source, or active
  const firstFunded = React.useMemo(() => {
    return (
      activeMintUrl ||
      mints.find((m) => (balances[m.mintUrl] || 0) > 0)?.mintUrl ||
      mints[0]?.mintUrl
    );
  }, [activeMintUrl, mints, balances]);

  const defaultTarget = React.useMemo(() => {
    return mints.find((m) => m.mintUrl !== firstFunded)?.mintUrl || mints[0]?.mintUrl || '';
  }, [mints, firstFunded]);

  const [sourceMintUrl, setSourceMintUrl] = useState<string>(firstFunded || '');
  const [targetMintUrl, setTargetMintUrl] = useState<string>(defaultTarget || '');

  const [status, setStatus] = useState<'success' | 'error' | 'cancelled'>('success');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const fiatValue = React.useMemo(() => {
    if (!btcData?.price) return '—';
    const sats = Number(amount) || 0;
    const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
    return fiat.toFixed(2);
  }, [amount, btcData?.price]);

  const amountNum = parseInt(amount, 10) || 0;
  const sourceBalance = sourceMintUrl ? balances[sourceMintUrl] || 0 : 0;

  // Derived selected Mint objects
  const sourceMint = mints.find((m) => m.mintUrl === sourceMintUrl);
  const targetMint = mints.find((m) => m.mintUrl === targetMintUrl);

  const handleSwap = useCallback(async () => {
    if (!sourceMintUrl || !targetMintUrl) {
      setError('Please select both source and target mints');
      return;
    }

    if (amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > sourceBalance) {
      setError('Insufficient balance in source mint');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (sourceMintUrl === targetMintUrl) {
        // Same-mint swap: simple refresh
        console.log(`[Swap] Single-mint swapping ${amountNum} sat on ${sourceMintUrl}`);
        const token = await walletService.send(sourceMintUrl, amountNum);
        await walletService.receive(token.token as any);
      } else {
        // Cross-mint swap via NUT-19 (Direct Atomic Swap or Optimized Route)
        console.log(
          `[Swap] Executing NUT-19 cross-mint swap (${amountNum} sat) from ${sourceMintUrl} to ${targetMintUrl}`,
        );
        await quotesService.swapMintToMint(sourceMintUrl, targetMintUrl, amountNum);
      }

      // Record transaction history entry for NUT-19 atomic swap
      try {
        const repo = initService.getRepo();
        if (repo?.historyRepository) {
          await (repo.historyRepository as any).addHistoryEntry({
            mintUrl: sourceMintUrl,
            type: 'swap',
            unit: 'sat',
            amount: amountNum,
            createdAt: Date.now(),
            state: 'completed',
            metadata: {
              via: 'swap',
              protocol: 'NUT-19',
              sourceMintUrl,
              targetMintUrl,
              sourceMintName:
                sourceMint?.name || sourceMintUrl.replace(/^https?:\/\//, '').split('/')[0],
              targetMintName:
                targetMint?.name || targetMintUrl.replace(/^https?:\/\//, '').split('/')[0],
            },
          });
        }
      } catch (histErr) {
        console.warn('[Swap] Failed to record history entry:', histErr);
      }

      setStatus('success');
      refreshBalance(); // fire-and-forget — don't block UI
      setStep('result');
    } catch (err: any) {
      console.error('[Swap] Failed:', err);
      setError(err.message || 'Transfer failed');
      setStatus('error');
      setStep('result');
    } finally {
      setIsProcessing(false);
    }
  }, [sourceMintUrl, targetMintUrl, amountNum, sourceBalance, refreshBalance]);

  const handleConfirmSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleSwap();
  };

  const handleNext = () => {
    if (step === 'amount') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep('confirm');
    }
  };

  const handleClose = () => {
    router.back();
    InteractionManager.runAfterInteractions(() => refreshBalance());
  };

  return (
    <YStack flex={1} bg="$background">
      {step === 'amount' && (
        <YStack flex={1} px="$4">
          <PaymentFlowHeader
            title="Transfer"
            navigationAction="close"
            onBack={handleClose}
            disabled={isProcessing}
          />
          <AmountStage
            amount={amount}
            setAmount={setAmount}
            sourceMintUrl={sourceMintUrl}
            setSourceMintUrl={setSourceMintUrl}
            targetMintUrl={targetMintUrl}
            setTargetMintUrl={setTargetMintUrl}
            onContinue={handleNext}
            isLoading={isProcessing}
            error={error}
          />
        </YStack>
      )}

      {step === 'confirm' && (
        <>
          <PaymentFlowHeader
            title="Confirm transfer"
            onBack={() => setStep('amount')}
            disabled={isProcessing}
          />
          <PaymentStageLayout
            disabled={isProcessing}
            hero={
              <PaymentAmount amount={Number(amount)} size="prominent" label="You're transferring" />
            }
            footer={
              <AppButton
                size="large"
                fullWidth
                loading={isProcessing}
                loadingText="Transferring ecash…"
                onPress={handleConfirmSubmit}
                disabled={isProcessing}
              >
                Transfer
              </AppButton>
            }
          >
            <ListTable compact>
              <PaymentMintRow
                label="From mint"
                mintUrl={sourceMintUrl}
                onSelect={setSourceMintUrl}
                disabled={isProcessing}
                method="melt-lightning"
              />
              <PaymentMintRow
                label="To mint"
                mintUrl={targetMintUrl}
                onSelect={setTargetMintUrl}
                disabled={isProcessing}
                method="mint-lightning"
              />
              <ListTableRow label="Method" value="Mint transfer" />
              <ListTableRow label="Fee" value="Calculated during transfer" />
            </ListTable>
          </PaymentStageLayout>
        </>
      )}

      {step === 'result' && (
        <YStack flex={1}>
          <ResultStage
            status={status}
            amount={amount}
            sourceMintUrl={sourceMintUrl}
            targetMintUrl={targetMintUrl}
            error={error}
            onClose={handleClose}
          />
        </YStack>
      )}
    </YStack>
  );
}
