import React from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { useLightningReceipt } from '../useLightningReceipt';
export function MeltResultStage({
  status,
  amount,
  mintUrl,
  time,
  feeSats,
  error,
  onClose,
  onRefresh,
  invoice,
  quoteId,
  recipient,
}: {
  status: 'success' | 'error' | 'pending' | 'unresolved';
  amount: number;
  feeReserve: number;
  mintUrl?: string;
  time?: number;
  feeSats?: number;
  error?: string | null;
  onClose: () => void;
  onRefresh?: () => void | Promise<void>;
  invoice?: string;
  quoteId?: string;
  recipient?: string | null;
}) {
  const details = useLightningReceipt({
    mintUrl,
    quoteId,
    invoice,
    recipient,
    incoming: false,
    state: status === 'success' ? 'paid' : status,
    amount,
  });
  return (
    <PaymentReceipt
      extraDetails={details.extraDetails}
      status={status === 'success' ? 'success' : status === 'error' ? 'error' : 'pending'}
      title={
        status === 'success'
          ? 'Payment completed'
          : status === 'pending'
            ? 'Payment pending'
            : status === 'unresolved'
              ? 'Payment unresolved'
              : 'Payment not completed'
      }
      amount={amount}
      mintUrl={mintUrl}
      time={time}
      fee={feeSats}
      completed={status === 'success'}
      statusLabel={status === 'unresolved' ? 'Unresolved' : undefined}
      onCheckStatus={status === 'pending' || status === 'unresolved' ? onRefresh : undefined}
      error={error}
      onClose={onClose}
    >
      {details.rows}
    </PaymentReceipt>
  );
}
