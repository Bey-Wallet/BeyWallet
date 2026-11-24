import React from 'react';
import { Text, YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { appTypography } from '~/shared/theme/appearance';
import { currencyService } from '~/services/wallet/currencyService';
import { formatPaymentDateTime } from '~/shared/utils/time';
import {
  normalizeBitcoinAddress,
  onchainNetwork,
  onchainNetworkDisplay,
} from '~/shared/utils/onchain';

export function OnchainPaymentStatus({
  status,
  direction,
  amount,
  mint,
  address,
  title,
  error,
  time,
  feeReserve,
  onClose,
  technicalDetails,
  transactionDetails,
}: {
  status: 'processing' | 'success' | 'error';
  direction: 'deposit' | 'withdrawal';
  amount?: number;
  mint: string;
  address?: string;
  title?: string;
  error?: string | null;
  time?: number;
  feeReserve?: number;
  onClose: () => void;
  technicalDetails?: React.ReactNode;
  transactionDetails?: React.ReactNode;
}) {
  const processing = status === 'processing';
  const deposit = direction === 'deposit';
  const destination = normalizeBitcoinAddress(address || '');
  const statusTitle =
    status === 'success'
      ? deposit
        ? 'Funds added'
        : 'Payment sent'
      : deposit
        ? 'Deposit not completed'
        : 'Payment not completed';
  const knownReserve = Number.isSafeInteger(feeReserve) && feeReserve! >= 0;
  return (
    <>
      <PaymentFlowHeader
        title={
          processing
            ? title || 'Processing payment'
            : deposit
              ? 'On-chain deposit'
              : 'On-chain payment'
        }
        navigationAction="close"
        disabled={processing}
        onBack={onClose}
      />
      <PaymentStageLayout
        variant="receipt"
        inset={false}
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
                  accessibilityLiveRegion="polite"
                >
                  {statusTitle}
                </Text>
              </>
            )}
            {amount != null ? (
              <PaymentAmount amount={amount} size="prominent" compact />
            ) : (
              <Text {...appTypography.title2} color="$color">
                Bitcoin on-chain
              </Text>
            )}
          </>
        }
        footer={
          <AppButton
            size="large"
            fullWidth
            emphasis="primary"
            loading={processing}
            loadingText={title || 'Processing payment'}
            disabled={processing}
            onPress={onClose}
          >
            Done
          </AppButton>
        }
      >
        <ListTable compact>
          {!processing && (
            <ListTableRow
              label="Status"
              value={status === 'success' ? (deposit ? 'Received' : 'Sent') : 'Not completed'}
            />
          )}
          <ListTableRow label="Mint" value={mint} />
          <ListTableRow label="Method" value="Bitcoin on-chain" />
          {!!destination && (
            <>
              <ListTableRow
                label="Network"
                value={onchainNetworkDisplay(onchainNetwork(destination))}
              />
              <ListTableRow
                label={deposit ? 'Address' : 'Destination'}
                value={destination}
                multiline
                isCopyable
                copyValue={destination}
              />
            </>
          )}
          {time != null && <ListTableRow label="Time" value={formatPaymentDateTime(time)} />}
          {processing && !deposit && (
            <ListTableRow
              label="Maximum network fee"
              value={knownReserve ? currencyService.formatSats(feeReserve!) : 'Unavailable'}
            />
          )}
          {!processing && status === 'success' && (
            <ListTableRow label="Fee paid" value="Unavailable" />
          )}
          {!deposit && status === 'success' && (
            <ListTableRow label="Blockchain confirmations" value="Not verified" />
          )}
          {!!error && <ListTableRow label="Details" value={error} multiline />}
          {!processing && transactionDetails}
        </ListTable>
        {!processing && technicalDetails}
      </PaymentStageLayout>
    </>
  );
}
