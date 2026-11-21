import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { mintInfoQueryOptions } from '~/shared/hooks/useMintInfo';
import { mintMetadataFromInfo } from '~/features/explore/components/mintMeta';

const mockStorage = new Map<string, string>();
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
  },
}));
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
  mockStorage.clear();
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

it('hydrates presentation metadata into a new session and still refreshes it live', async () => {
  await client.fetchQuery(mintInfoQueryOptions(url));
  client.clear();
  const options = mintInfoQueryOptions(url);
  const observer = new QueryObserver(client, options);
  expect(observer.getCurrentResult().data).toEqual(info);
  expect(observer.getCurrentResult().isStale).toBe(true);
  fetchMock.mockResolvedValueOnce(reply({ ...info, name: 'Updated' }));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    expect(observer.getCurrentResult().data?.name).toBe('Updated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    unsubscribe();
    observer.destroy();
  }
});

it('keeps persisted hints available after an offline refresh and rejects malformed or expired caches', async () => {
  await client.fetchQuery(mintInfoQueryOptions(url));
  client.clear();
  fetchMock.mockRejectedValueOnce(new Error('Offline'));
  const observer = new QueryObserver(client, mintInfoQueryOptions(url));
  const result = await observer.refetch();
  expect(result.isError).toBe(true);
  expect(result.data).toEqual(info);
  observer.destroy();
  const key = `mint-health-v1:metadata:${url}`;
  mockStorage.set(key, JSON.stringify({ data: { nuts: [] }, savedAt: Date.now() }));
  expect(mintInfoQueryOptions(url).initialData?.()).toBeUndefined();
  mockStorage.set(
    key,
    JSON.stringify({ data: info, savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
  );
  expect(mintInfoQueryOptions(url).initialData?.()).toBeUndefined();
  expect(mintInfoQueryOptions(url, 'background').initialData).toBeUndefined();
});

it('releases hung directory requests so an opened mint can finish loading', async () => {
  jest.useFakeTimers();
  try {
    for (let index = 0; index < 4; index++) {
      fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    }
    const background = Array.from({ length: 4 }, (_, index) =>
      client
        .fetchQuery(mintInfoQueryOptions(`https://stuck${index}.example`, 'background'))
        .catch((error) => error),
    );
    await jest.advanceTimersByTimeAsync(0);
    const opened = client.fetchQuery(mintInfoQueryOptions('https://opened.example', 'interactive'));
    await jest.advanceTimersByTimeAsync(8000);
    await expect(opened).resolves.toEqual(info);
    expect(await Promise.all(background)).toEqual(
      Array.from({ length: 4 }, () => expect.objectContaining({ name: 'AbortError' })),
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  } finally {
    jest.useRealTimers();
  }
});
