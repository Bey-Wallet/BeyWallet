import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { mintInfoQueryOptions } from '~/shared/hooks/useMintInfo';
import { mintMetadataFromInfo } from '~/features/explore/components/mintMeta';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));
const fetchMock = jest.fn();
const url = 'https://mint.example/Bitcoin';
const info = {
  name: 'Mint',
  icon_url: 'https://mint.example/icon.png',
  nuts: { '4': { methods: [{ method: 'onchain' }] }, '5': { methods: [{ method: 'onchain' }] } },
};
const reply = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
let client: QueryClient;
let originalFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  originalFetch = global.fetch;
  global.fetch = fetchMock;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchMock.mockResolvedValue(reply(info));
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

it('deduplicates metadata requests across normalized URLs and retains distinct path identities', async () => {
  const [first, second] = await Promise.all([
    client.fetchQuery(mintInfoQueryOptions('https://MINT.example/Bitcoin/')),
    client.fetchQuery(mintInfoQueryOptions(url)),
  ]);
  expect(first).toEqual(second);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    `${url}/v1/info`,
    expect.objectContaining({ signal: expect.anything() }),
  );
  await client.fetchQuery(mintInfoQueryOptions('https://mint.example/bitcoin'));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('rechecks fresh data on demand and retains cached metadata after a failed check', async () => {
  const options = mintInfoQueryOptions(url);
  await client.fetchQuery(options);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    const failed = await observer.refetch({ cancelRefetch: false });
    expect(failed.isError).toBe(true);
    expect(failed.data?.name).toBe('Mint');
    fetchMock.mockResolvedValueOnce(reply({ ...info, name: 'Fresh mint' }));
    const refreshed = await observer.refetch({ cancelRefetch: false });
    expect(refreshed.isError).toBe(false);
    expect(refreshed.data?.name).toBe('Fresh mint');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally {
    unsubscribe();
    observer.destroy();
  }
});

it('keeps icon fallback and on-chain capability projection without caching a failed fallback', () => {
  const fallback = mintMetadataFromInfo(undefined, url);
  expect(fallback.icon).toContain('favicon');
  expect(mintMetadataFromInfo(info, url)).toMatchObject({
    icon: info.icon_url,
    supportsNut30: true,
  });
  expect(mintInfoQueryOptions('javascript:alert(1)').enabled).toBe(false);
});
