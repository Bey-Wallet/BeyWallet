import { mintRecommendationService } from '~/services/api/mintRecommendationService';
import { mintHealthService, type RadarDiscoveryMint } from '~/services/api/mintHealthService';

const mockQuery = jest.fn();
const mockClose = jest.fn();
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn(() => ({ querySync: mockQuery, close: mockClose })),
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
