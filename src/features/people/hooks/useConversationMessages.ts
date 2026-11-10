import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { initService } from '~/services/wallet/initService';
import type { MessageCursor } from '~/storage/sqlite/repositories/MessageRepository';

export function useConversationMessages(npub: string, session: number, revision: number) {
  const queryClient = useQueryClient();
  const queryKey = ['conversation-messages', session, npub] as const;
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as MessageCursor | null,
    queryFn: async ({ pageParam, signal }) => {
      const page = await initService.getRepo().messageRepository.pageBefore(npub, pageParam);
      if (signal.aborted) throw new Error('Message query cancelled');
      return page;
    },
    getNextPageParam: (page) => {
      const last = page.at(-1);
      return page.length === 50 && last
        ? { createdAt: last.createdAt, receivedAt: last.receivedAt, id: last.id }
        : undefined;
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const previous = useRef({ npub, session, revision });
  useEffect(() => {
    const old = previous.current;
    previous.current = { npub, session, revision };
    if (old.npub === npub && old.session === session && old.revision !== revision)
      void queryClient.invalidateQueries({
        queryKey: ['conversation-messages', session, npub],
        exact: true,
      });
  }, [npub, session, revision, queryClient]);
  const messages = useMemo(() => {
    const byId = new Map(query.data?.pages.flat().map((message) => [message.id, message]));
    return [...byId.values()];
  }, [query.data]);
  return { ...query, messages };
}
