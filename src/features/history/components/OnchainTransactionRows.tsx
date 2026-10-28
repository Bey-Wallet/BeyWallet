import { interactionCopy } from '~/services/feedback/interactionCopy';
import React from 'react';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';
import { ExternalLink } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { ListTableRow } from '~/shared/ui/ListTable';
import {
  normalizeBitcoinAddress,
  transactionIdFromOutpoint,
  blockchainTransactionUrl,
} from '~/shared/utils/onchain';
import { fetchDepositTransactionIds } from '~/services/api/onchainTransactionService';
import { quotesService } from '~/services/wallet';

export function OnchainTransactionRows({
  direction,
  address,
  mintUrl,
  quoteId,
  pending = false,
}: {
  direction: 'deposit' | 'withdrawal';
  address: string;
  mintUrl?: string;
  quoteId?: string;
  pending?: boolean;
}) {
  const toast = useAppToast();
  const destination = normalizeBitcoinAddress(address);
  const { data: transactionIds } = useQuery({
    queryKey: ['onchainTransactionIds', direction, destination, mintUrl, quoteId],
    queryFn: async () => {
      if (direction === 'withdrawal') {
        if (!mintUrl || !quoteId) return [];
        const quote = await quotesService.checkOnchainMeltQuote(mintUrl, quoteId);
        const txid = transactionIdFromOutpoint(quote.outpoint);
        return txid ? [txid] : [];
      }
      return fetchDepositTransactionIds(destination);
    },
    enabled: !!destination,
    staleTime: 30_000,
    refetchInterval: pending ? 10_000 : false,
    retry: 1,
  });

  if (!transactionIds?.length) {
    return <ListTableRow label="Transaction hash" value="Unavailable" />;
  }

  return (
    <YStack separator={<YStack height={2} width="100%" bg="$background" />}>
      {transactionIds.map((txid, index) => {
        const url = blockchainTransactionUrl(txid, destination);
        return (
          <ListTableRow
            key={txid}
            label={transactionIds.length > 1 ? `Transaction hash ${index + 1}` : 'Transaction hash'}
            value={`${txid.slice(0, 10)}…${txid.slice(-8)}`}
            rightContent={url ? <ExternalLink size={20} color="$gray10" /> : undefined}
            onPress={
              url
                ? () => {
                    void Linking.openURL(url).catch(() =>
                      toast.showFeedback(interactionCopy.couldNotOpenBlockchainExplorer),
                    );
                  }
                : undefined
            }
          />
        );
      })}
    </YStack>
  );
}
