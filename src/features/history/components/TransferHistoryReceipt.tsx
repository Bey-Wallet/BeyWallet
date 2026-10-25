import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ResultStage } from '~/features/payments/swap/ResultStage';
import { getMintTransferService } from '~/services/wallet/mintTransferService';

export function TransferHistoryReceipt({
  id,
  amount,
  sourceMintUrl,
  targetMintUrl,
  onClose,
  headerRight,
}: {
  id: string;
  amount: number;
  sourceMintUrl: string;
  targetMintUrl: string;
  onClose: () => void;
  headerRight?: () => React.ReactNode;
}) {
  const result = useQuery({
    queryKey: ['mintTransfer', id],
    queryFn: () => getMintTransferService().refresh(id),
    refetchInterval: (query) => (query.state.data?.state === 'committed' ? 10_000 : false),
  });
  const record = result.data;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight:
            record && ['completed', 'failed'].includes(record.state) ? headerRight : () => null,
        }}
      />
      <ResultStage
        status={
          record?.state === 'completed'
            ? 'success'
            : record?.state === 'failed'
              ? 'error'
              : 'pending'
        }
        amount={String(amount)}
        sourceMintUrl={sourceMintUrl}
        targetMintUrl={targetMintUrl}
        record={record}
        error={record?.state === 'failed' ? 'The source mint did not complete the payment.' : null}
        onCheckStatus={() => result.refetch().then(() => {})}
        checking={result.isFetching}
        onClose={onClose}
      />
    </SafeAreaView>
  );
}
