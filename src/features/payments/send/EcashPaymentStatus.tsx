import React from 'react';
import { Text, YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentTechnicalDetails } from '../PaymentTechnicalDetails';
import { useWalletStore } from '~/state/walletStore';
import { currencyService } from '~/services/wallet/currencyService';
import { appTypography } from '~/shared/theme/appearance';
import { formatPaymentDateTime } from '~/shared/utils/time';

/** Creation, delivery and claim remain distinct; this never infers settlement. */
export function EcashPaymentStatus({
  status,
  amount,
  mintUrl,
  fee,
  time,
  operationId,
  recipient,
  method = 'Ecash',
  title,
  error,
  onClose,
}: {
  status: 'processing' | 'success' | 'error';
  amount: number;
  mintUrl?: string;
  fee?: number | null;
  time?: number;
  operationId?: string;
  recipient?: string;
  method?: string;
  title?: string;
  error?: string | null;
  onClose: () => void;
}) {
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find(
    (item) => item.mintUrl.replace(/\/$/, '') === mintUrl?.replace(/\/$/, ''),
  );
  const processing = status === 'processing';
  const knownFee = fee != null && Number.isSafeInteger(fee) && fee >= 0;
  return (
    <>
      <PaymentFlowHeader
        title={processing ? 'Processing payment' : 'Ecash payment'}
        navigationAction="close"
        disabled={processing}
        onBack={onClose}
      />
      <PaymentStageLayout
        variant="receipt"
        disabled={processing}
        hero={
          <>
            {!processing && (
              <>
                <YStack height={68} items="center" justify="center">
                  <PaymentStatusIcon status={status} />
                </YStack>
                <Text
                  {...appTypography.title3}
                  color="$color"
                  textAlign="center"
                  accessibilityRole="header"
                >
                  {status === 'error' ? 'Payment not completed' : title || 'Ecash claimed'}
                </Text>
              </>
            )}
            <PaymentAmount amount={amount} size="prominent" compact />
          </>
        }
        footer={
          <AppButton
            size="large"
            fullWidth
            emphasis="primary"
            disabled={processing}
            accessibilityState={{ busy: processing, disabled: processing }}
            loading={processing}
            loadingText="Processing"
            onPress={onClose}
          >
            {processing ? 'Processing' : 'Done'}
          </AppButton>
        }
      >
        <ListTable compact>
          {!processing && (
            <ListTableRow
              label="Status"
              value={status === 'success' ? 'Completed' : 'Not completed'}
            />
          )}
          {recipient && <ListTableRow label="To" value={recipient} multiline expandValue />}
          {!!mintUrl && (
            <ListTableRow
              label="Mint"
              value={mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '')}
            />
          )}
          <ListTableRow label="Method" value={method} />
          {time != null && <ListTableRow label="Time" value={formatPaymentDateTime(time)} />}
          <ListTableRow
            label={status === 'success' ? 'Fee paid' : 'Creation fee'}
            value={knownFee ? currencyService.formatSats(fee!) : 'Unavailable'}
          />
          {status !== 'error' && (
            <ListTableRow
              label="Total"
              value={knownFee ? currencyService.formatSats(amount + fee!) : 'Unavailable'}
            />
          )}
          {!!error && <ListTableRow label="Details" value={error} multiline expandValue />}
        </ListTable>
        {!processing && (
          <PaymentTechnicalDetails
            entry={{
              id: '',
              type: 'send',
              amount,
              unit: 'sat',
              mintUrl: mintUrl || '',
              createdAt: time || 0,
              operationId,
              state: status === 'success' ? 'claimed' : 'failed',
              metadata: {
                ...(status === 'success' && knownFee ? { fee } : {}),
                recipient,
                ...(method === 'Nostr' ? { via: 'nostr' } : {}),
              },
            }}
          />
        )}
      </PaymentStageLayout>
    </>
  );
}
