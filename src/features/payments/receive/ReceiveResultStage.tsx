import React, { useState } from 'react';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { AppButton } from '~/shared/ui/AppButton';
export function ReceiveResultStage({
  status,
  amount,
  mintUrl,
  error,
  isReceiveLater,
  isLoading,
  onClose,
  onClaimNow,
}: {
  status: 'success' | 'error';
  amount: string;
  token?: string;
  mintUrl?: string;
  error?: string | null;
  isReceiveLater?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onClaimNow?: () => void;
  title?: string;
}) {
  const [time] = useState(Date.now);
  const savedOffline =
    status === 'error' &&
    !!error &&
    (error.includes('Could not connect to mint') ||
      error.includes('saved to your transaction history') ||
      error.includes('saved in your history'));
  const complete = status === 'success' && !isReceiveLater;
  return (
    <PaymentReceipt
      status={complete ? 'success' : isReceiveLater || savedOffline ? 'pending' : 'error'}
      title={
        complete
          ? 'Ecash received'
          : isReceiveLater || savedOffline
            ? 'Ecash awaiting claim'
            : 'Receive not completed'
      }
      amount={Number(amount)}
      mintUrl={mintUrl}
      time={time}
      completed={complete}
      error={error}
      onClose={onClose}
    >
      {!complete && onClaimNow && (
        <AppButton loading={isLoading} disabled={isLoading} onPress={onClaimNow}>
          Claim now
        </AppButton>
      )}
    </PaymentReceipt>
  );
}
