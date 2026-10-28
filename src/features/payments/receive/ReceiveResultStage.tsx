import React, { useState } from 'react';
import { useResultHaptic } from '~/shared/hooks/useResultHaptic';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { AppButton } from '~/shared/ui/AppButton';
import { Text } from 'tamagui';
import { ListTableRow } from '~/shared/ui/ListTable';
export function ReceiveResultStage({
  status,
  amount,
  mintUrl,
  note,
  error,
  isReceiveLater,
  isLoading,
  onClose,
  onClaimNow,
  offline = false,
}: {
  status: 'success' | 'error';
  amount: string;
  token?: string;
  mintUrl?: string;
  note?: string;
  error?: string | null;
  isReceiveLater?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onClaimNow?: () => void;
  title?: string;
  offline?: boolean;
}) {
  const [time] = useState(Date.now);
  const savedOffline =
    status === 'error' &&
    !!error &&
    (error.includes('Could not connect to mint') ||
      error.includes('saved to your transaction history') ||
      error.includes('saved in your history'));
  const complete = status === 'success' && !isReceiveLater;
  useResultHaptic(!complete && !isReceiveLater && !savedOffline ? 'error' : undefined);
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
      {!!note?.trim() && (
        <ListTableRow label="Note" value={note} isCopyable copyValue={note} multiline />
      )}
      {!complete && offline && (
        <Text color="$gray10" fontSize="$3" textAlign="center">
          Go online to claim this ecash from History.
        </Text>
      )}
      {!complete && !offline && onClaimNow && (
        <AppButton loading={isLoading} disabled={isLoading} onPress={onClaimNow}>
          Claim now
        </AppButton>
      )}
    </PaymentReceipt>
  );
}
