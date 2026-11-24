import React, { useRef, useState } from 'react';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { Text, YStack } from 'tamagui';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentActionsMenu } from '~/shared/ui/PaymentActionsMenu';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { TransferTechnicalDetails } from './TransferTechnicalDetails';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { appTypography } from '~/shared/theme/appearance';
import { formatPaymentDateTime } from '~/shared/utils/time';
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
  statusCheckFailed = false,
  onRetry,
  extraDetails,
  headerRight,
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
  statusCheckFailed?: boolean;
  onRetry?: () => void;
  extraDetails?: React.ReactNode;
  headerRight?: () => React.ReactNode;
}) {
  const [localCheckFailed, setLocalCheckFailed] = useState(false);
  const offline = useOfflineStatus();
  const [localChecking, setLocalChecking] = useState(false);
  const checkLock = useRef(false);
  const pending = status === 'pending';
  const checkFailed = statusCheckFailed || localCheckFailed;
  const busy = !!checking || localChecking;
  const checkStatus = async () => {
    if (!onCheckStatus || offline || busy || checkLock.current) return;
    checkLock.current = true;
    setLocalChecking(true);
    setLocalCheckFailed(false);
    try {
      await onCheckStatus();
    } catch {
      setLocalCheckFailed(true);
    } finally {
      checkLock.current = false;
      setLocalChecking(false);
    }
  };
  const mints = useWalletStore((state) => state.mints);
  const mintName = (url: string) => {
    const mint = mints.find((item) => item.mintUrl.replace(/\/+$/, '') === url.replace(/\/+$/, ''));
    return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '');
  };
  const value = record?.amount ?? Number(amount);
  const knownFee =
    record?.feePaid != null && Number.isSafeInteger(record.feePaid) && record.feePaid >= 0;
  const knownReserve =
    record != null && Number.isSafeInteger(record.feeReserve) && record.feeReserve >= 0;
  const actualFee = status === 'success' || knownFee;
  const fee = actualFee
    ? knownFee
      ? record!.feePaid!
      : null
    : knownReserve
      ? record!.feeReserve
      : null;
  const title =
    status === 'success'
      ? 'Transfer completed'
      : pending
        ? record?.stage === 'settlement'
          ? 'Transfer needs review'
          : 'Transfer pending'
        : status === 'cancelled'
          ? 'Transfer cancelled'
          : 'Transfer not completed';
  const statusLabel = pending
    ? record?.stage === 'settlement'
      ? 'Checking transfer outcome'
      : record?.stage === 'issuance'
        ? 'Waiting for destination ecash'
        : 'Payment in progress'
    : status === 'success'
      ? 'Completed'
      : status === 'cancelled'
        ? 'Cancelled'
        : 'Not completed';
  const technical = record ? <TransferTechnicalDetails record={record} /> : extraDetails;
  return (
    <>
      <PaymentFlowHeader
        title="Transfer"
        navigationAction="close"
        onBack={onClose}
        headerRight={
          headerRight ||
          (() => <PaymentActionsMenu actions={[]} technicalDetails={technical} busy={busy} />)
        }
      />
      <PaymentStageLayout
        variant="receipt"
        hero={
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
              {title}
            </Text>
            <PaymentAmount amount={value} size="prominent" compact />
          </>
        }
        footer={
          <AppButton size="large" fullWidth emphasis="primary" onPress={onClose}>
            Done
          </AppButton>
        }
      >
        {pending && onCheckStatus && (
          <AppButton
            size="small"
            fullWidth={false}
            self="center"
            emphasis="secondary"
            loading={busy}
            loadingText="Checking transfer"
            disabled={offline || busy}
            onPress={checkStatus}
          >
            Check status
          </AppButton>
        )}
        <ListTable compact>
          <ListTableRow label="Status" value={statusLabel} />
          <ListTableRow
            label="From mint"
            value={mintName(record?.sourceMintUrl || sourceMintUrl)}
          />
          <ListTableRow label="To mint" value={mintName(record?.targetMintUrl || targetMintUrl)} />
          {record?.createdAt != null && (
            <ListTableRow label="Time" value={formatPaymentDateTime(record.createdAt)} />
          )}
          <ListTableRow
            label={actualFee ? 'Fee paid' : 'Maximum fee'}
            value={fee == null ? 'Unavailable' : currencyService.formatSats(fee)}
          />
          {status !== 'error' && status !== 'cancelled' && (
            <ListTableRow
              label={actualFee ? 'Total' : 'Maximum total'}
              value={
                fee != null && Number.isSafeInteger(value + fee)
                  ? currencyService.formatSats(value + fee)
                  : 'Unavailable'
              }
            />
          )}
          {!!error && <ListTableRow label="Details" value={error} multiline />}
        </ListTable>
        {pending &&
          (checkFailed || record?.stage === 'settlement' || record?.stage === 'issuance') && (
            <Text
              {...appTypography.body2}
              color="$gray10"
              textAlign="center"
              accessibilityRole={checkFailed ? 'alert' : undefined}
            >
              {checkFailed
                ? 'Could not verify this transfer. Check status before starting another.'
                : record?.stage === 'settlement'
                  ? 'The mints returned conflicting results. Keep checking this transfer before starting another.'
                  : 'The destination mint is still issuing your ecash.'}
            </Text>
          )}
        {status === 'error' && record?.state === 'failed' && onRetry && (
          <AppButton
            size="small"
            fullWidth={false}
            self="center"
            emphasis="secondary"
            onPress={onRetry}
          >
            Try again
          </AppButton>
        )}
      </PaymentStageLayout>
    </>
  );
}
