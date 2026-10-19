import React from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
export function MeltResultStage({
  status,
  amount,
  mintUrl,
  time,
  feeSats,
  error,
  onClose,
  onRefresh,
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
}) {
  return (
    <PaymentReceipt
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
      error={error}
      onClose={onClose}
    >
      {(status === 'pending' || status === 'unresolved') && onRefresh && (
        <PaymentStatusRow
          value={status === 'unresolved' ? 'Unresolved' : 'Pending'}
          onRefresh={onRefresh}
        />
      )}
    </PaymentReceipt>
  );
}
