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

export function PaymentReceipt({
  title,
  amount,
  mintUrl,
  completed,
  status,
  inset,
  actionLabel = 'Done',
  actionEmphasis = 'secondary',
  time,
  fee,
  error,
  children,
  onClose,
}: {
  title: string;
  amount: number;
  mintUrl?: string;
  completed: boolean;
  inset?: boolean;
  actionLabel?: string;
  actionEmphasis?: 'primary' | 'secondary';
  status?: 'success' | 'error' | 'pending' | 'cancelled';
  time?: number;
  fee?: number;
  error?: string | null;
  children?: React.ReactNode;
  onClose: () => void;
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
          <PaymentAmount amount={amount} compact />
          {!!error && (
            <>
              <AppButton
                size="small"
                emphasis="text-only"
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
          variant={actionEmphasis === 'secondary' ? 'default' : 'branded'}
          emphasis={actionEmphasis}
          size="large"
          fullWidth
          onPress={onClose}
        >
          {actionLabel}
        </AppButton>
      }
    >
      <PaymentFlowHeader title={title} onBack={onClose} />
      <ListTable compact>
        {mintUrl && (
          <ListTableRow
            label="Mint"
            value={
              mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
            }
          />
        )}
        {time != null && <ListTableRow label="Time" value={new Date(time).toLocaleString()} />}
        {completed && fee != null && Number.isFinite(fee) && fee > 0 && (
          <ListTableRow label="Fee" value={currencyService.formatSats(fee)} />
        )}
        {children}
      </ListTable>
    </PaymentStageLayout>
  );
}
