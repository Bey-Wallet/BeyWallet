import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePeopleStore } from '~/state/peopleStore';
import { useMessageStore } from '~/state/messageStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { useSettingsStore } from '~/state/settingsStore';
import { historyService } from '~/services/wallet/historyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { buildPeopleListModel } from '../peopleListModel';
import { hydrateSavedPeople } from '../peopleProfileCache';
import { parsePersonHistoryMetadata, type PersonHistoryEntry } from '../personHistory';
import { useNostrProfileSearch } from './useNostrProfileSearch';

export async function loadPeopleHistory(): Promise<PersonHistoryEntry[]> {
  const entries = new Map<string, PersonHistoryEntry>();
  for (let offset = 0; ; offset += 500) {
    const page = await historyService.getHistory(500, offset);
    for (const entry of page as PersonHistoryEntry[]) {
      if (
        (entry.type === 'send' || entry.type === 'receive') &&
        typeof parsePersonHistoryMetadata(entry.metadata)?.nostrPubkey === 'string'
      )
        entries.set(entry.id, entry);
    }
    if (page.length < 500) return [...entries.values()];
  }
}

const EMPTY_HISTORY: PersonHistoryEntry[] = [];

export function usePeopleList(search: string) {
  const people = usePeopleStore((state) => state.people);
  const messages = useMessageStore((state) => state.recent);
  const unread = useMessageStore((state) => state.unread);
  const inbox = useNostrInboxStore((state) => state.items);
  const requests = useNostrRequestStore((state) => state.requests);
  const requestPayments = useNostrRequestStore((state) => state.payments);
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const remote = useNostrProfileSearch(search);
  const history = useQuery({
    queryKey: ['history', 'people', inbox.filter((item) => item.status === 'claimed').length],
    queryFn: loadPeopleHistory,
    placeholderData: (previous) => previous,
  });
  const price = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    enabled: primaryCurrency === 'FIAT' && secondaryCurrency !== 'NONE',
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const refreshingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    void hydrateSavedPeople(Object.values(people)).catch(() => undefined);
  }, [people]);
  const formatAmount = useCallback(
    (amount: number) => {
      if (primaryCurrency === 'FIAT' && secondaryCurrency !== 'NONE' && price.data?.price)
        return currencyService.formatValue(
          currencyService.convertSatsToCurrency(amount, price.data.price),
          secondaryCurrency as CurrencyCode,
        );
      return currencyService.formatSats(amount);
    },
    [primaryCurrency, secondaryCurrency, price.data?.price],
  );
  const model = useMemo(
    () =>
      buildPeopleListModel({
        people,
        messages,
        inbox,
        unread,
        history: history.data || EMPTY_HISTORY,
        query: search,
        remote: remote.results,
        formatAmount,
        requests,
        requestPayments,
      }),
    [
      people,
      messages,
      inbox,
      unread,
      history.data,
      search,
      remote.results,
      formatAmount,
      requests,
      requestPayments,
    ],
  );
  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError('');
    try {
      const results = await Promise.allSettled([
        hydrateSavedPeople(Object.values(usePeopleStore.getState().people), { forceRefresh: true }),
        history.refetch({ throwOnError: true }),
        useMessageStore.getState().refresh(),
      ]);
      if (mounted.current && results.some((result) => result.status === 'rejected'))
        setRefreshError('Some activity could not be refreshed. Pull to retry.');
    } finally {
      refreshingRef.current = false;
      if (mounted.current) setRefreshing(false);
    }
  };
  return {
    ...model,
    refreshing,
    refresh,
    isSearching: remote.isSearching,
    searchError: remote.error,
    retrySearch: remote.retry,
    activityError:
      refreshError || (history.isError ? 'Payment history is unavailable. Pull to retry.' : ''),
  };
}
