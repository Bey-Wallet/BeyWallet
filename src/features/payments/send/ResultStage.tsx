import React, { useState, useRef } from 'react';
import { EcashPaymentStatus } from './EcashPaymentStatus';
import { PendingTokenLayout } from '~/shared/ui/PendingTokenLayout';
import {
  ReceiptImageShare,
  type ReceiptImageShareAction,
} from '~/features/history/components/ReceiptImageShare';
import { buildShareableReceipt } from '~/features/history/shareableReceipt';
import { cleanToken } from '~/services/wallet/tokenUtils';

interface ResultStageProps {
  status: 'success' | 'error';
  amount: string;
  token?: string | null;
  mintUrl?: string;
  fee?: number;
  method?: string;
  recipient?: string;
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
  const receiptAction = useRef<ReceiptImageShareAction>(null);
  const [reclaiming, setReclaiming] = useState(false);
  const receipt =
    props.status === 'success' && props.token
      ? buildShareableReceipt({
          id: props.operationId || 'pending-send',
          type: 'send',
          state: 'unclaimed',
          amount: Number(props.amount),
          unit: 'sat',
          mintUrl: props.mintUrl || '',
          createdAt: time,
        })
      : null;
  if (props.status === 'success' && props.token)
    return (
      <>
        <PendingTokenLayout
          onClose={props.onClose}
          navigationAction="close"
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
          menuActions={
            receipt
              ? [
                  {
                    id: 'receipt-image',
                    title: 'Share receipt image',
                    disabled: reclaiming,
                    onPress: () => receiptAction.current?.open(),
                  },
                ]
              : []
          }
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
        {receipt && (
          <ReceiptImageShare
            receipt={receipt}
            ecashToken={cleanToken(props.token)}
            disabled={reclaiming}
            hideTrigger
            actionRef={receiptAction}
          />
        )}
      </>
    );
  return (
    <EcashPaymentStatus
      status={props.status === 'success' ? 'success' : 'error'}
      title={
        props.status === 'error' ? 'Payment not completed' : props.title || 'Payment completed'
      }
      amount={Number(props.amount)}
      mintUrl={props.mintUrl}
      time={time}
      fee={props.fee}
      operationId={props.operationId}
      method={props.method}
      recipient={props.recipient}
      error={props.error}
      onClose={props.onClose}
    />
  );
}
