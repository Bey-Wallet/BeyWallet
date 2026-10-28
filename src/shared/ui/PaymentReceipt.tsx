import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import React, { useState } from 'react';
import { Text } from 'tamagui';

import { AppButton } from '~/shared/ui/AppButton';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useWalletStore } from '~/state/walletStore';
import { currencyService } from '~/services/wallet/currencyService';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { formatPaymentDateTime } from '~/shared/utils/time';

export function PaymentReceipt({
  title,
  amount,
  mintUrl,
  completed,
  status,
  statusLabel,
  onCheckStatus,
  isCheckingStatus,
  amountTestID,
  inset,
  actionLabel = 'Done',
  actionEmphasis = 'secondary',
  time,
  fee,
  error,
  children,
  onClose,
  navigationAction = 'close',
}: {
  title: string;
  amount: number;
  mintUrl?: string;
  completed: boolean;
  inset?: boolean;
  actionLabel?: string;
  actionEmphasis?: 'primary' | 'secondary';
  status?: 'success' | 'error' | 'pending' | 'cancelled';
  statusLabel?: string;
  onCheckStatus?: () => void | Promise<void>;
  isCheckingStatus?: boolean;
  amountTestID?: string;
  time?: number;
  fee?: number;
  error?: string | null;
  children?: React.ReactNode;
  onClose: () => void;
  navigationAction?: 'back' | 'close';
}) {
  const mints = useWalletStore((s) => s.mints);
  const mint = mints.find((m) => m.mintUrl.replace(/\/$/, '') === mintUrl?.replace(/\/$/, ''));
  const [details, setDetails] = useState(false);
  const receiptStatus = status ?? (completed ? 'success' : error ? 'error' : 'pending');
  return (
    <PaymentStageLayout
      variant="receipt"
      inset={inset}
      hero={
        <>
          <PaymentStatusIcon status={receiptStatus} />
          <Text
            accessibilityRole="header"
            fontSize={16}
            fontWeight="500"
            color="$color"
            textAlign="center"
          >
            {title}
          </Text>
          <PaymentAmount
            amount={amount}
            size={receiptStatus === 'pending' ? 'standard' : 'prominent'}
            compact
            testID={amountTestID}
          />
          {!!error && (
            <>
              <AppButton
                size="small"
                emphasis="text"
                accessibilityState={{ expanded: details }}
                onPress={() => setDetails(!details)}
              >
                {details ? 'Hide details' : 'View details'}
              </AppButton>
              {details && (
                <Text color="$gray10" selectable>
                  {error}
                </Text>
              )}
            </>
          )}
        </>
      }
      footer={
        <AppButton
          variant="default"
          emphasis={actionEmphasis}
          size="large"
          fullWidth
          onPress={onClose}
        >
          {actionLabel}
        </AppButton>
      }
    >
      <PaymentFlowHeader title={title} navigationAction={navigationAction} onBack={onClose} />
      <ListTable compact>
        {receiptStatus === 'pending' && onCheckStatus && (
          <PaymentStatusRow
            status="pending"
            value={statusLabel ?? 'Pending'}
            onRefresh={onCheckStatus}
            checking={isCheckingStatus}
          />
        )}
        {mintUrl && (
          <ListTableRow
            label="Mint"
            value={
              mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
            }
          />
        )}
        {time != null && <ListTableRow label="Time" value={formatPaymentDateTime(time)} />}
        {completed && fee != null && Number.isFinite(fee) && fee > 0 && (
          <ListTableRow label="Fee" value={currencyService.formatSats(fee)} />
        )}
        {children}
      </ListTable>
    </PaymentStageLayout>
  );
}
