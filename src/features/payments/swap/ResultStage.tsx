import React, { useState } from 'react';
import { useResultHaptic } from '~/shared/hooks/useResultHaptic';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { ListTableRow } from '~/shared/ui/ListTable';
import { Text } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import type { MintTransferRecord } from '~/services/wallet/mintTransferService';
import { currencyService } from '~/services/wallet/currencyService';
import { useWalletStore } from '~/state/walletStore';
export function ResultStage({
  status,
  amount,
  sourceMintUrl,
  targetMintUrl,
  error,
  onClose,
  record,
  onCheckStatus,
  checking,
  onRetry,
}: {
  status: 'success' | 'error' | 'pending' | 'cancelled';
  amount: string;
  sourceMintUrl: string;
  targetMintUrl: string;
  error: string | null;
  onClose: () => void;
  record?: MintTransferRecord;
  onCheckStatus?: () => Promise<void>;
  checking?: boolean;
  onRetry?: () => void;
}) {
  const [time] = useState(Date.now);
  useResultHaptic(status === 'error' ? 'error' : undefined);
  const mints = useWalletStore((state) => state.mints);
  const mintName = (url: string) => {
    const mint = mints.find((item) => item.mintUrl.replace(/\/+$/, '') === url.replace(/\/+$/, ''));
    return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '');
  };
  return (
    <PaymentReceipt
      status={status}
      title={
        status === 'success'
          ? 'Transfer completed'
          : status === 'pending'
            ? 'Transfer pending'
            : status === 'cancelled'
              ? 'Transfer cancelled'
              : 'Transfer not completed'
      }
      amount={Number(amount)}
      time={record?.createdAt ?? time}
      completed={status === 'success'}
      statusLabel={
        record?.stage === 'issuance' ? 'Waiting for destination ecash' : 'Payment in progress'
      }
      onCheckStatus={onCheckStatus}
      isCheckingStatus={checking}
      error={error}
      onClose={onClose}
    >
      <ListTableRow label="From mint" value={mintName(sourceMintUrl)} />
      <ListTableRow label="To mint" value={mintName(targetMintUrl)} />
      {record && (
        <ListTableRow
          label={record.feePaid == null ? 'Maximum fee' : 'Fee'}
          value={currencyService.formatSats(record.feePaid ?? record.feeReserve)}
        />
      )}
      {status === 'pending' && (
        <Text color="$gray10" fontSize={12} px="$4" py="$3">
          The transfer will continue checking automatically. You can close this screen.
        </Text>
      )}
      {onRetry && (
        <AppButton size="medium" emphasis="secondary" onPress={onRetry}>
          Try again
        </AppButton>
      )}
    </PaymentReceipt>
  );
}
