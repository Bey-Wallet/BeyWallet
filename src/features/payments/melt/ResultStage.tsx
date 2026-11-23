import React, { useEffect, useRef, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { Spinner } from '~/shared/ui/Spinner';
import { appTypography } from '~/shared/theme/appearance';
import { currencyService } from '~/services/wallet/currencyService';
import { useWalletStore } from '~/state/walletStore';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { useLightningReceipt } from '../useLightningReceipt';

const presentation = {
  processing: {
    title: 'Processing payment',
    status: 'Processing',
    message: '',
  },
  pending: {
    title: 'Payment pending',
    status: 'Pending',
    message: 'The mint is still settling this payment. Check its status before paying again.',
  },
  unresolved: {
    title: 'Awaiting confirmation',
    status: 'Unconfirmed',
    message: 'The outcome is not confirmed yet. Check status or History before paying again.',
  },
  success: { title: 'Payment completed', status: 'Completed', message: '' },
  error: {
    title: 'Payment not completed',
    status: 'Not completed',
    message: 'Review the details and History before trying again.',
  },
} as const;

export function MeltResultStage({
  status,
  amount,
  feeReserve,
  mintUrl,
  time,
  feeSats,
  error,
  onClose,
  onRefresh,
  checking,
  invoice,
  quoteId,
  recipient,
}: {
  status: keyof typeof presentation;
  amount: number;
  feeReserve: number;
  mintUrl?: string;
  time?: number;
  feeSats?: number;
  error?: string | null;
  onClose: () => void;
  onRefresh?: () => void | Promise<void>;
  checking?: boolean;
  invoice?: string;
  quoteId?: string;
  recipient?: string | null;
}) {
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find(
    (item) => item.mintUrl.replace(/\/$/, '') === mintUrl?.replace(/\/$/, ''),
  );
  const processing = status === 'processing';
  const pending = status === 'pending' || status === 'unresolved';
  const shown = presentation[status];
  const [checkFailed, setCheckFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => setCheckFailed(false), [status]);
  const checkStatus = async () => {
    setCheckFailed(false);
    try {
      await onRefresh?.();
    } catch {
      if (mounted.current) setCheckFailed(true);
    }
  };
  const details = useLightningReceipt({
    mintUrl,
    quoteId,
    invoice,
    recipient,
    incoming: false,
    extraDetailsPresentation: 'sheet',
    state: status === 'success' ? 'paid' : status,
    amount,
  });
  const knownFee = Number.isSafeInteger(feeSats) && feeSats! >= 0;
  return (
    <>
      <PaymentFlowHeader
        title={processing ? shown.title : 'Lightning payment'}
        navigationAction="close"
        disabled={processing}
        onBack={onClose}
      />
      <PaymentStageLayout
        variant="receipt"
        hero={
          <>
            {!processing && (
              <YStack height={68} items="center" justify="center">
                <PaymentStatusIcon
                  status={
                    status === 'success' ? 'success' : status === 'error' ? 'error' : 'pending'
                  }
                />
              </YStack>
            )}
            {!processing && (
              <Text
                {...appTypography.title3}
                color="$color"
                textAlign="center"
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
              >
                {shown.title}
              </Text>
            )}
            <PaymentAmount amount={amount} size="prominent" compact />
            {!!shown.message && (
              <YStack justify="center">
                <Text {...appTypography.body2} color="$gray10" textAlign="center">
                  {shown.message}
                </Text>
              </YStack>
            )}
          </>
        }
        footer={
          <AppButton
            size="large"
            fullWidth
            emphasis="primary"
            disabled={processing}
            accessibilityState={{ busy: processing, disabled: processing }}
            icon={processing ? <Spinner size={22} /> : undefined}
            onPress={onClose}
          >
            {processing ? 'Processing' : 'Done'}
          </AppButton>
        }
      >
        {pending && (
          <AppButton
            size="small"
            fullWidth={false}
            self="center"
            emphasis="secondary"
            disabled={!onRefresh || checking}
            loading={checking}
            loadingText="Checking…"
            onPress={checkStatus}
          >
            Check status
          </AppButton>
        )}
        <ListTable compact>
          {!processing && <ListTableRow label="Status" value={shown.status} />}
          {!!mintUrl && (
            <ListTableRow
              label="Mint"
              value={mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '')}
            />
          )}
          {time != null && <ListTableRow label="Time" value={formatPaymentDateTime(time)} />}
          {status === 'success' ? (
            <ListTableRow
              label="Fee paid"
              value={knownFee ? currencyService.formatSats(feeSats!) : 'Unavailable'}
            />
          ) : (
            <>
              <ListTableRow label="Maximum fee" value={currencyService.formatSats(feeReserve)} />
              <ListTableRow
                label="Maximum total"
                value={currencyService.formatSats(amount + feeReserve)}
              />
            </>
          )}
          {details.rows}
          {!!error && <ListTableRow label="Details" value={error} multiline expandValue />}
        </ListTable>
        {checkFailed && (
          <Text {...appTypography.body2} color="$gray10" accessibilityRole="alert">
            Could not check status. Your payment is still unconfirmed. Try again when connected.
          </Text>
        )}
        {!processing && details.extraDetails}
      </PaymentStageLayout>
    </>
  );
}
