import { QueryClient } from '@tanstack/react-query';
import { hydrateBitcoinPriceCache } from '~/shared/utils/bitcoinPriceQueryCache';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));

const cached = { price: 84_000, change24h: -1.2, updatedAt: 123 };
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest
    .mocked(sqliteStorage.getItem)
    .mockImplementation((key) => (key === 'btc_price_cache_usd' ? JSON.stringify(cached) : null));
});
afterEach(() => client.clear());

it('restores persisted quotes immediately without treating an old quote as fresh', () => {
  hydrateBitcoinPriceCache(client);
  expect(client.getQueryData(['bitcoinPrice', 'USD'])).toEqual(cached);
  expect(client.getQueryState(['bitcoinPrice', 'USD'])?.dataUpdatedAt).toBe(123_000);
  expect(client.getQueryData(['bitcoinPrice', 'AED'])).toBeUndefined();
  expect(client.getQueryDefaults(['bitcoinPrice']).gcTime).toBe(Infinity);
});

it('keeps the cached amount during a refresh, then publishes the new quote to all readers', async () => {
  hydrateBitcoinPriceCache(client);
  let complete!: (value: typeof cached) => void;
  const refresh = client.fetchQuery({
    queryKey: ['bitcoinPrice', 'USD'],
    queryFn: () =>
      new Promise<typeof cached>((resolve) => {
        complete = resolve;
      }),
  });
  expect(client.getQueryState(['bitcoinPrice', 'USD'])?.fetchStatus).toBe('fetching');
  expect(client.getQueryData(['bitcoinPrice', 'USD'])).toEqual(cached);
  const updated = { ...cached, price: 90_000, updatedAt: 456 };
  complete(updated);
  await refresh;
  expect(client.getQueryData(['bitcoinPrice', 'USD'])).toEqual(updated);
});

it('retains cached data after a failed refresh and never borrows another currency quote', async () => {
  hydrateBitcoinPriceCache(client);
  await expect(
    client.fetchQuery({
      queryKey: ['bitcoinPrice', 'USD'],
      queryFn: async () => {
        throw new Error('Offline');
      },
    }),
  ).rejects.toThrow('Offline');
  expect(client.getQueryData(['bitcoinPrice', 'USD'])).toEqual(cached);
  expect(client.getQueryData(['bitcoinPrice', 'KWD'])).toBeUndefined();
});

it.each([
  'bad json',
  '{}',
  '{"price":0,"change24h":0,"updatedAt":1}',
  '{"price":100,"change24h":0,"updatedAt":null}',
])('ignores an invalid persisted quote: %s', (raw) => {
  jest.mocked(sqliteStorage.getItem).mockReturnValue(raw);
  hydrateBitcoinPriceCache(client);
  expect(client.getQueryData(['bitcoinPrice', 'USD'])).toBeUndefined();
});
