import React, { useState } from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { ListTableRow } from '~/shared/ui/ListTable';
export function ResultStage({
  status,
  amount,
  sourceMintUrl,
  targetMintUrl,
  error,
  onClose,
}: {
  status: 'success' | 'error' | 'cancelled';
  amount: string;
  sourceMintUrl: string;
  targetMintUrl: string;
  error: string | null;
  onClose: () => void;
}) {
  const [time] = useState(Date.now);
  return (
    <PaymentReceipt
      status={status}
      title={
        status === 'success'
          ? 'Swap completed'
          : status === 'cancelled'
            ? 'Swap cancelled'
            : 'Swap not completed'
      }
      amount={Number(amount)}
      mintUrl={sourceMintUrl}
      time={time}
      completed={status === 'success'}
      error={error}
      onClose={onClose}
    >
      <ListTableRow label="Destination mint" value={targetMintUrl.replace(/^https?:\/\//, '')} />
    </PaymentReceipt>
  );
}
