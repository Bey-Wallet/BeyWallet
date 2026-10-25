import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { YStack, Text } from 'tamagui';
import { useWalletStore } from '~/state/walletStore';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import { currencyService } from '~/services/wallet/currencyService';
import {
  getMintTransferService,
  type MintTransferRecord,
} from '~/services/wallet/mintTransferService';
import { AmountStage } from './AmountStage';
import { ResultStage } from './ResultStage';

export default function SwapScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mints = useWalletStore((s) => s.mints);
  const balances = useWalletStore((s) => s.balances);
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const service = useMemo(() => getMintTransferService(), []);
  const [step, setStep] = useState<'amount' | 'confirm' | 'result'>('amount');
  const [amount, setAmount] = useState('0');
  const [sourceMintUrl, setSourceMintUrl] = useState(
    () =>
      mints.find((m) => m.mintUrl === activeMintUrl && (balances[m.mintUrl] || 0) > 0)?.mintUrl ||
      mints.find((m) => (balances[m.mintUrl] || 0) > 0)?.mintUrl ||
      activeMintUrl ||
      '',
  );
  const [targetMintUrl, setTargetMintUrl] = useState(
    () => mints.find((m) => m.mintUrl !== sourceMintUrl)?.mintUrl || '',
  );
  const [record, setRecord] = useState<MintTransferRecord>();
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const submitting = useRef(false);
  usePreventRemove(isProcessing, () => {});

  useEffect(() => {
    if (step !== 'confirm') return;
    let active = true;
    let prepared: MintTransferRecord | undefined;
    setRecord(undefined);
    setError(null);
    setQuoting(true);
    void service.prepare(sourceMintUrl, targetMintUrl, Number(amount)).then(
      (value) => {
        prepared = value;
        if (active) {
          setRecord(value);
          setQuoting(false);
        } else void service.discard(value.id).catch(() => {});
      },
      (failure) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : 'Could not prepare transfer.');
          setQuoting(false);
        }
      },
    );
    return () => {
      active = false;
      if (prepared) void service.discard(prepared.id).catch(() => {});
    };
  }, [step, sourceMintUrl, targetMintUrl, amount, service]);

  const result = useQuery({
    queryKey: ['mintTransfer', record?.id],
    queryFn: () => service.refresh(record!.id),
    enabled:
      step === 'result' && !!record && !['failed', 'completed', 'discarded'].includes(record.state),
    refetchInterval: (query) =>
      query.state.data && !['failed', 'completed', 'discarded'].includes(query.state.data.state)
        ? 10_000
        : false,
    initialData: record,
  });
  const displayed = result.data?.id === record?.id ? result.data : record;
  const pending = !!displayed && !['failed', 'completed', 'discarded'].includes(displayed.state);
  useEffect(() => {
    if (step !== 'result') return;
    void queryClient.invalidateQueries({ queryKey: ['history'] });
    void useWalletStore.getState().refreshBalance();
  }, [step, displayed?.state, queryClient]);

  const submit = async () => {
    if (!record || submitting.current) return;
    submitting.current = true;
    setIsProcessing(true);
    setError(null);
    try {
      const value = await service.execute(record.id);
      setRecord(value);
      queryClient.setQueryData(['mintTransfer', value.id], value);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete transfer.');
      setRecord(undefined);
    } finally {
      setStep('result');
      setIsProcessing(false);
      submitting.current = false;
    }
  };

  const close = () => router.back();
  if (step === 'result') {
    const completed = displayed?.state === 'completed';
    return (
      <ResultStage
        status={completed ? 'success' : pending ? 'pending' : 'error'}
        amount={amount}
        sourceMintUrl={sourceMintUrl}
        targetMintUrl={targetMintUrl}
        record={displayed}
        error={
          displayed?.state === 'failed' ? 'The source mint did not complete the payment.' : error
        }
        onCheckStatus={() => result.refetch().then(() => {})}
        checking={result.isFetching}
        onRetry={
          !pending && !completed
            ? () => {
                setError(null);
                setStep('amount');
              }
            : undefined
        }
        onClose={close}
      />
    );
  }
  return (
    <YStack flex={1} bg="$background">
      {step === 'amount' ? (
        <YStack flex={1} px="$4">
          <PaymentFlowHeader title="Transfer" navigationAction="close" onBack={close} />
          <AmountStage
            amount={amount}
            setAmount={setAmount}
            sourceMintUrl={sourceMintUrl}
            setSourceMintUrl={setSourceMintUrl}
            targetMintUrl={targetMintUrl}
            setTargetMintUrl={setTargetMintUrl}
            onContinue={() => setStep('confirm')}
            error={error}
          />
        </YStack>
      ) : (
        <>
          <PaymentFlowHeader
            title="Confirm transfer"
            onBack={() => setStep('amount')}
            disabled={isProcessing}
          />
          <PaymentStageLayout
            disabled={isProcessing}
            hero={
              <>
                <PaymentAmount
                  amount={Number(amount)}
                  size="prominent"
                  label="You're transferring"
                />
                {quoting && <Spinner size="small" />}
                {error && (
                  <Text color="$red10" textAlign="center" accessibilityRole="alert">
                    {error}
                  </Text>
                )}
              </>
            }
            footer={
              <AppButton
                size="large"
                fullWidth
                loading={isProcessing}
                loadingText="Transferring ecash…"
                disabled={quoting || isProcessing || !record}
                onPress={submit}
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
              <ListTableRow
                label="Maximum fee"
                value={record ? currencyService.formatSats(record.feeReserve) : 'Unavailable'}
              />
              <ListTableRow
                label="Maximum total"
                value={
                  record
                    ? currencyService.formatSats(record.amount + record.feeReserve)
                    : 'Unavailable'
                }
              />
            </ListTable>
            {!quoting && error && (
              <AppButton size="medium" emphasis="secondary" onPress={() => setStep('amount')}>
                Change amount or retry
              </AppButton>
            )}
          </PaymentStageLayout>
        </>
      )}
    </YStack>
  );
}
