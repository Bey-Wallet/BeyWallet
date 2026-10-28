import React, { useState } from 'react';
import { useResultHaptic } from '~/shared/hooks/useResultHaptic';
import * as Haptics from 'expo-haptics';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';

interface ResultStageProps {
  status: 'success' | 'error' | 'cancelled';
  amount: string;
  mintUrl?: string;
  /** Confirmed fee in sats, when available; never an estimate or keyset fee. */
  feeSats?: number;
  error?: string | null;
  onClose: () => void;
}

export function ResultStage({
  status,
  amount,
  mintUrl,
  feeSats,
  error,
  onClose,
}: ResultStageProps) {
  const [time] = useState(Date.now);
  useResultHaptic(status === 'error' ? 'error' : undefined);

  return (
    <PaymentReceipt
      status={status}
      title={
        status === 'success'
          ? 'Funds added'
          : status === 'cancelled'
            ? 'Top-up cancelled'
            : 'Top-up not completed'
      }
      amount={parseInt(amount, 10) || 0}
      amountTestID="mint-result"
      mintUrl={mintUrl}
      completed={status === 'success'}
      time={time}
      fee={feeSats}
      error={error}
      inset={false}
      onClose={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
      }}
    />
  );
}
