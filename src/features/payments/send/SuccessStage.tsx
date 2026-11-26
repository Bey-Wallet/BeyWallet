import React, { useState } from 'react';
import { EcashPaymentStatus } from './EcashPaymentStatus';
export function SuccessStage({
  amount,
  mintUrl,
  fee,
  operationId,
  method,
  recipient,
  onClose,
}: {
  amount: string;
  mintUrl?: string;
  fee?: number;
  operationId?: string;
  method?: string;
  recipient?: string;
  onClose: () => void;
}) {
  const [time] = useState(Date.now);
  return (
    <EcashPaymentStatus
      status="success"
      title="Ecash claimed"
      amount={Number(amount)}
      mintUrl={mintUrl}
      fee={fee}
      operationId={operationId}
      method={method}
      recipient={recipient}
      time={time}
      onClose={onClose}
    />
  );
}
