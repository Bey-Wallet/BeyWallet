import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMintDiscovery } from '~/features/mints/hooks/useMintDiscovery';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';

jest.mock('~/services/api/mintRecommendationService', () => ({
  mintRecommendationService: { discoverMints: jest.fn() },
}));

function Probe() {
  const query = useMintDiscovery();
  return React.createElement('Discovery', {
    mints: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    refetch: query.refetch,
  });
}

it('makes partial discoveries usable while fetching and preserves them during refresh', async () => {
  const requests: any[] = [];
  jest.mocked(mintRecommendationService.discoverMints).mockImplementation(
    (_limit, options) =>
      new Promise((resolve) => {
        requests.push({ ...options, resolve });
      }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    const state = () => tree.root.findByType('Discovery' as any).props;
    expect(state().loading).toBe(true);
    const early = [{ url: 'https://early.example', reviewsCount: 0, averageRating: null }];
    await act(async () => {
      requests[0].onUpdate(early);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(state().mints).toEqual(early);
    expect(state().loading).toBe(false);
    expect(state().fetching).toBe(true);
    await act(async () => {
      requests[0].resolve(early);
      for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(state().fetching).toBe(false);
    await act(async () => {
      void state().refetch();
    });
    expect(requests[1].initialMints).toEqual(early);
    expect(state().mints).toEqual(early);
    expect(state().loading).toBe(false);
    await act(async () => {
      await client.cancelQueries();
      requests[1].onUpdate([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(requests[1].signal.aborted).toBe(true);
    expect(state().mints).toEqual(early);
  } finally {
    await act(async () => tree?.unmount());
    client.clear();
  }
});
