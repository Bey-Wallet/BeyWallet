import React, { useState } from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
export function SuccessStage({
  amount,
  mintUrl,
  fee,
  onClose,
}: {
  amount: string;
  mintUrl?: string;
  fee?: number;
  onClose: () => void;
}) {
  const [time] = useState(Date.now);
  return (
    <PaymentReceipt
      title="Ecash claimed"
      amount={Number(amount)}
      mintUrl={mintUrl}
      fee={fee}
      time={time}
      completed
      onClose={onClose}
    />
  );
}
