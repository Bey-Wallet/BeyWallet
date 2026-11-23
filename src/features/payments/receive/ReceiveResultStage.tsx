import React from 'react';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { Spinner } from '~/shared/ui/Spinner';
import { appTypography } from '~/shared/theme/appearance';
import { useWalletStore } from '~/state/walletStore';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { currencyService } from '~/services/wallet/currencyService';
import type { ReceiptEntry } from '~/features/history/receiptDetails';
import { historyMetadata } from '~/features/history/transactionPresentation';
import { PaymentTechnicalDetails } from '../PaymentTechnicalDetails';
import { AppButton } from '~/shared/ui/AppButton';
import { Text, YStack } from 'tamagui';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
export function ReceiveResultStage({
  status,
  amount,
  mintUrl,
  note,
  error,
  isReceiveLater,
  isLoading,
  saving = false,
  receipt,
  onClose,
  onClaimNow,
  offline = false,
}: {
  status: 'success' | 'error';
  amount: string;
  token?: string;
  mintUrl?: string;
  note?: string;
  error?: string | null;
  isReceiveLater?: boolean;
  isLoading?: boolean;
  saving?: boolean;
  receipt?: ReceiptEntry;
  onClose: () => void;
  onClaimNow?: () => void;
  title?: string;
  offline?: boolean;
}) {
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find(
    (item) => item.mintUrl.replace(/\/$/, '') === mintUrl?.replace(/\/$/, ''),
  );
  const processing = !!isLoading;
  const savedOffline =
    status === 'error' &&
    !!error &&
    (error.includes('Could not connect to mint') ||
      error.includes('saved to your transaction history') ||
      error.includes('saved in your history'));
  const complete = status === 'success' && !isReceiveLater;
  const pending = !!isReceiveLater || savedOffline;
  const title = complete
    ? 'Ecash received'
    : pending
      ? 'Ecash awaiting claim'
      : 'Receive not completed';
  const metadata = receipt ? historyMetadata(receipt) : {};
  const fee = metadata.actualFee ?? metadata.fee;
  const knownFee = typeof fee === 'number' && Number.isSafeInteger(fee) && fee >= 0;
  return (
    <>
      <PaymentFlowHeader
        title={processing ? (saving ? 'Saving ecash' : 'Receiving ecash') : 'Ecash receive'}
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
                  <PaymentStatusIcon
                    status={complete ? 'success' : pending ? 'pending' : 'error'}
                  />
                </YStack>
                <Text
                  {...appTypography.title3}
                  color="$color"
                  textAlign="center"
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                >
                  {title}
                </Text>
              </>
            )}
            <PaymentAmount amount={Number(amount)} size="prominent" compact />
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
            {processing ? (saving ? 'Saving' : 'Receiving') : 'Done'}
          </AppButton>
        }
      >
        {!processing && !complete && !offline && onClaimNow && (
          <AppButton
            haptic
            size="small"
            fullWidth={false}
            self="center"
            emphasis="secondary"
            onPress={onClaimNow}
          >
            {pending ? 'Claim now' : 'Retry receive'}
          </AppButton>
        )}
        <ListTable compact>
          {!processing && (
            <ListTableRow
              label="Status"
              value={complete ? 'Received' : pending ? 'Awaiting claim' : 'Not completed'}
            />
          )}
          {!!mintUrl && (
            <ListTableRow
              label="Mint"
              value={mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '')}
            />
          )}
          <ListTableRow label="Method" value="Ecash" />
          {receipt?.createdAt != null && (
            <ListTableRow label="Time" value={formatPaymentDateTime(receipt.createdAt)} />
          )}
          {!processing && complete && (
            <ListTableRow
              label="Fee paid"
              value={knownFee ? currencyService.formatSats(fee) : 'Unavailable'}
            />
          )}
          {!!note?.trim() && (
            <ListTableRow label="Note" value={note} isCopyable copyValue={note} multiline />
          )}
          {!processing && !!error && <ListTableRow label="Details" value={error} multiline />}
        </ListTable>
        {!processing && pending && (
          <Text {...appTypography.body2} color="$gray10" textAlign="center">
            {offline
              ? 'Saved on this device. Go online to claim it from History.'
              : 'Your balance changes after the mint confirms the claim.'}
          </Text>
        )}
        {!processing && receipt && <PaymentTechnicalDetails entry={receipt} />}
      </PaymentStageLayout>
    </>
  );
}
