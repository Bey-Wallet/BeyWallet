import { mintRecommendationService } from '~/services/api/mintRecommendationService';
import { mintHealthService, type RadarDiscoveryMint } from '~/services/api/mintHealthService';

const mockQuery = jest.fn();
const mockClose = jest.fn();
const mockSubscribe = jest.fn();
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn(() => ({
    querySync: mockQuery,
    subscribeEose: mockSubscribe,
    close: mockClose,
  })),
}));
jest.mock('~/state/nostrRelayStore', () => ({ getNostrQueryRelays: (relays: string[]) => relays }));
jest.mock('~/services/api/mintHealthService', () => ({
  ...jest.requireActual('~/services/api/mintHealthService'),
  mintHealthService: { radarList: jest.fn(), cachedRadarList: jest.fn() },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));

const radarMint = (index: number): RadarDiscoveryMint => ({
  url: `https://mint${index}.example/Bitcoin`,
  name: `Mint ${index}`,
  status: 'online',
  score: 90,
  scoreStale: false,
  downSince: null,
  scoreCappedNew: false,
  isTest: false,
  uptime24hPct: 100,
  uptime7dPct: 99,
  lastCheckedAt: null,
  reviewsCount: 0,
  averageRating: null,
});
beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue([]);
  jest.mocked(mintHealthService.radarList).mockResolvedValue([]);
  jest.mocked(mintHealthService.cachedRadarList).mockReturnValue(undefined);
});

it('includes every MintRadar mint without the previous discovery result cap', async () => {
  const directory = Array.from({ length: 150 }, (_, index) => radarMint(index));
  directory[149] = { ...directory[149], status: 'archived', isTest: true, score: null };
  jest.mocked(mintHealthService.radarList).mockResolvedValue(directory);
  const result = await mintRecommendationService.discoverMints();
  expect(result.map((mint) => mint.url)).toEqual(
    expect.arrayContaining(directory.map((mint) => mint.url)),
  );
  expect(result.find((mint) => mint.url === directory[149].url)).toMatchObject({
    status: 'archived',
    isTestnet: true,
  });
  expect(result[0].status).toBe('online');
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it('merges duplicate relay URLs while preserving different paths and real review counts', async () => {
  jest.mocked(mintHealthService.radarList).mockResolvedValue([radarMint(0)]);
  mockQuery.mockImplementation(async (_, filter) =>
    filter.kinds[0] === 38172
      ? [
          {
            tags: [['u', 'https://MINT0.example/Bitcoin/']],
            content: JSON.stringify({ name: 'Relay alias', description: 'Community mint' }),
          },
          {
            tags: [['u', 'https://mint0.example/bitcoin']],
            content: JSON.stringify({ name: 'Other endpoint' }),
          },
        ]
      : [],
  );
  const result = await mintRecommendationService.discoverMints();
  expect(result.filter((mint) => mint.url === radarMint(0).url)).toHaveLength(1);
  expect(result.find((mint) => mint.url === radarMint(0).url)).toMatchObject({
    name: 'Mint 0',
    description: 'Community mint',
    reviewsCount: 0,
    averageRating: null,
  });
  expect(result.some((mint) => mint.url === 'https://mint0.example/bitcoin')).toBe(true);
});

it('retains the directory when relay queries fail', async () => {
  jest.mocked(mintHealthService.radarList).mockResolvedValue([radarMint(0)]);
  mockQuery.mockRejectedValue(new Error('Relays unavailable'));
  const result = await mintRecommendationService.discoverMints();
  expect(result.some((mint) => mint.url === radarMint(0).url)).toBe(true);
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it('ranks only current online Radar scores and preserves provider order for ties', async () => {
  const directory = [
    { ...radarMint(0), score: 80 },
    { ...radarMint(1), score: 99 },
    { ...radarMint(2), score: 99 },
    { ...radarMint(3), score: 100, scoreStale: true },
    { ...radarMint(4), score: 100, status: 'offline' },
    { ...radarMint(5), score: null },
  ];
  jest.mocked(mintHealthService.radarList).mockResolvedValue(directory);
  const result = await mintRecommendationService.discoverMints();
  const rank = (index: number) =>
    result.find((mint) => mint.url === radarMint(index).url)?.radarRank;
  expect([rank(0), rank(1), rank(2)]).toEqual([3, 1, 2]);
  expect([rank(3), rank(4), rank(5)]).toEqual([undefined, undefined, undefined]);
});

it('retains NIP-87 discoveries when MintRadar fails', async () => {
  jest.mocked(mintHealthService.radarList).mockRejectedValue(new Error('Provider unavailable'));
  mockQuery.mockImplementation(async (_, filter) =>
    filter.kinds[0] === 38172
      ? [{ tags: [['u', 'https://relay-mint.example']], content: '{"name":"Relay mint"}' }]
      : [],
  );
  const result = await mintRecommendationService.discoverMints();
  expect(result.find((mint) => mint.url === 'https://relay-mint.example')?.name).toBe('Relay mint');
});

it('restores the saved directory when a provider refresh fails', async () => {
  jest.mocked(mintHealthService.radarList).mockRejectedValue(new Error('Provider unavailable'));
  jest
    .mocked(mintHealthService.cachedRadarList)
    .mockReturnValue({ data: [radarMint(0)], savedAt: 1000 });
  const result = await mintRecommendationService.discoverMints();
  expect(result.some((mint) => mint.url === radarMint(0).url)).toBe(true);
});

it('allows callers such as Home recommendations to request a short list explicitly', async () => {
  jest
    .mocked(mintHealthService.radarList)
    .mockResolvedValue(Array.from({ length: 50 }, (_, i) => radarMint(i)));
  expect(await mintRecommendationService.discoverMints(20)).toHaveLength(20);
});

function streamingHarness() {
  const streams = new Map<number, { onevent: (event: any) => void; onclose: () => void }>();
  const close = jest.fn();
  mockSubscribe.mockImplementation((_relays, filter, callbacks) => {
    streams.set(filter.kinds[0], callbacks);
    return { close };
  });
  const finish = () => streams.forEach((stream) => stream.onclose());
  return { streams, finish, close };
}

it('publishes saved mints before either network source finishes', async () => {
  const h = streamingHarness();
  let resolveRadar!: (mints: RadarDiscoveryMint[]) => void;
  jest.mocked(mintHealthService.radarList).mockReturnValue(
    new Promise((resolve) => {
      resolveRadar = resolve;
    }),
  );
  jest
    .mocked(mintHealthService.cachedRadarList)
    .mockReturnValue({ data: [radarMint(0)], savedAt: 1 });
  const onUpdate = jest.fn();
  const discovery = mintRecommendationService.discoverMints(Infinity, { onUpdate });
  expect(onUpdate.mock.calls[0][0]).toEqual(
    expect.arrayContaining([expect.objectContaining({ url: radarMint(0).url })]),
  );
  resolveRadar([radarMint(1)]);
  await Promise.resolve();
  expect(onUpdate.mock.calls.at(-1)![0]).toEqual(
    expect.arrayContaining([expect.objectContaining({ url: radarMint(1).url })]),
  );
  h.finish();
  await discovery;
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it('streams relay discoveries before EOSE and appends later results without moving rows', async () => {
  jest.useFakeTimers();
  try {
    const h = streamingHarness();
    let resolveRadar!: (mints: RadarDiscoveryMint[]) => void;
    jest.mocked(mintHealthService.radarList).mockReturnValue(
      new Promise((resolve) => {
        resolveRadar = resolve;
      }),
    );
    const onUpdate = jest.fn();
    let completed = false;
    const discovery = mintRecommendationService
      .discoverMints(Infinity, { onUpdate })
      .then((mints) => {
        completed = true;
        return mints;
      });
    const event = {
      tags: [['u', 'https://early.example']],
      content: '{"name":"First arrival"}',
    };
    h.streams.get(38172)!.onevent(event);
    jest.advanceTimersByTime(100);
    const early = onUpdate.mock.calls.at(-1)![0];
    expect(early.at(-1).url).toBe('https://early.example');
    expect(completed).toBe(false);
    h.streams.get(38172)!.onevent({ ...event, content: '{"name":"Updated arrival"}' });
    resolveRadar([radarMint(2)]);
    await Promise.resolve();
    expect(early.at(-1).name).toBe('First arrival');
    h.finish();
    const result = await discovery;
    expect(result.slice(0, early.length).map((mint) => mint.url)).toEqual(
      early.map((mint: { url: string }) => mint.url),
    );
    expect(result.at(-1)?.url).toBe(radarMint(2).url);
    expect(result.find((mint) => mint.url === 'https://early.example')?.name).toBe(
      'Updated arrival',
    );
  } finally {
    jest.useRealTimers();
  }
});

it('closes subscriptions on cancellation and ignores late relay events', async () => {
  const h = streamingHarness();
  const controller = new AbortController();
  jest
    .mocked(mintHealthService.radarList)
    .mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject())),
    );
  const onUpdate = jest.fn();
  const discovery = mintRecommendationService.discoverMints(Infinity, {
    onUpdate,
    signal: controller.signal,
  });
  const rejected = expect(discovery).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  h.streams.get(38172)!.onevent({ tags: [['u', 'https://late.example']], content: '{}' });
  await rejected;
  expect(h.close).toHaveBeenCalledTimes(2);
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(mockClose).toHaveBeenCalledTimes(1);
});
