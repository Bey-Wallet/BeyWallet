import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventService } from '~/services/wallet/eventService';
import { initService } from '~/services/wallet/initService';
import {
  usePaymentListening,
  usePendingPaymentPolling,
} from '~/shared/hooks/usePendingPaymentPolling';
import type { ConversationActivity } from '../conversationActivity';
import { conversationPaymentSettled, type PersonHistoryEntry } from '../personHistory';
import { readConversationPaymentStatus } from '../conversationPaymentStatus';

export function useConversationPaymentStatus(
  npub: string,
  session: number,
  activity: ConversationActivity[],
  history: PersonHistoryEntry[],
) {
  const client = useQueryClient();
  const listening = usePaymentListening(!!npub);
  const key = ['conversation-payment-status', npub, session];
  const candidates = activity.filter(
    (item) =>
      item.kind === 'payment' &&
      (!item.message || item.direction === 'incoming' || item.message.publication === 'sent') &&
      (item.history || item.message?.paymentId || item.paymentInput?.route === 'lightning'),
  );
  const query = useQuery({
    queryKey: key,
    enabled: false,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const statuses = { ...client.getQueryData<Record<string, string>>(key) };
      for (const item of candidates) {
        // PAID quotes still need to reach ISSUED before they show Received.
        if (conversationPaymentSettled(statuses[item.id]) && statuses[item.id] !== 'Paid') continue;
        try {
          const status = await readConversationPaymentStatus(item, history);
          if (status) statuses[item.id] = status;
        } catch {
          // Keep the last verified state on offline/incomplete responses.
        }
      }
      return statuses;
    },
  });
  const refetch = query.refetch;
  usePendingPaymentPolling(
    async () => {
      await refetch({ cancelRefetch: false });
    },
    candidates.some(
      (item) =>
        !conversationPaymentSettled(query.data?.[item.id]) || query.data?.[item.id] === 'Paid',
    ),
  );
  useEffect(() => {
    if (!listening || !initService.isInitialized()) return;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['history', 'conversation', npub] });
      void refetch({ cancelRefetch: false });
    };
    refresh();
    const unsubscribe = [
      eventService.on('history:updated', refresh),
      eventService.on('mint-quote:state-changed', refresh),
      eventService.on('mint-quote:redeemed', refresh),
      eventService.on('proofs:state-changed', refresh),
      eventService.on('melt-quote:paid', refresh),
    ];
    return () => unsubscribe.forEach((off) => off());
  }, [client, listening, npub, session, refetch]);
  return query.data || {};
}
