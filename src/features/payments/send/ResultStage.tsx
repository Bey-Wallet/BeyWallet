import React, { useState } from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { PendingTokenLayout } from '~/shared/ui/PendingTokenLayout';

interface ResultStageProps {
  status: 'success' | 'error';
  amount: string;
  token?: string | null;
  mintUrl?: string;
  fee?: number;
  operationId?: string;
  error?: string | null;
  onClose: () => void;
  onReclaim?: () => void;
  title?: string;
  expiresAt?: number;
  reclaimAt?: number;
  onCheckStatus?: () => void | Promise<void>;
  isCheckingStatus?: boolean;
}

export function ResultStage(props: ResultStageProps) {
  const [time] = useState(Date.now);
  const [reclaiming, setReclaiming] = useState(false);
  if (props.status === 'success' && props.token)
    return (
      <PendingTokenLayout
        token={props.token}
        operationId={props.operationId}
        amount={props.amount}
        fee={props.fee}
        mintUrl={props.mintUrl}
        expiresAt={props.expiresAt}
        reclaimAt={props.reclaimAt}
        headerStatus="pending"
        onCheckStatus={props.onCheckStatus}
        isCheckingStatus={props.isCheckingStatus}
        isReclaiming={reclaiming}
        onReclaim={
          props.onReclaim
            ? async () => {
                setReclaiming(true);
                try {
                  await props.onReclaim?.();
                } finally {
                  setReclaiming(false);
                }
              }
            : undefined
        }
      />
    );
  return (
    <PaymentReceipt
      status={props.status === 'success' ? 'success' : 'error'}
      title={props.status === 'error' ? 'Send not completed' : props.title || 'Ecash sent'}
      amount={Number(props.amount)}
      mintUrl={props.mintUrl}
      time={time}
      fee={props.fee}
      completed={props.status === 'success'}
      error={props.error}
      onClose={props.onClose}
    />
  );
}
