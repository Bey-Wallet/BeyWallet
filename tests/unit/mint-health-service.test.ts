import {
  mintHealthService,
  mintHealthUrl,
  parseRadarHealth,
  parseRadarList,
  parseCashuHealthDetail,
  parseCashuHealthList,
} from '~/services/api/mintHealthService';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));
const url = 'https://mint.example/Bitcoin';
const radar = {
  mint: {
    url,
    score: 98,
    uptime24hPct: 100,
    uptime7dPct: 99.5,
    lastCheckedAt: '2026-10-20T05:25:00Z',
  },
};
const summary = {
  id: 'mint1',
  url,
  lastCheck: '2026-10-20T05:20:00Z',
  uptime24h: 100,
  uptime7d: 99,
};
const detail = {
  id: 'mint1',
  url,
  network: { country: 'us' },
  uptime: { '24h': 100, '7d': 99 },
  daily: [
    { day: '2026-10-18', uptime: 100, checks: 288 },
    { day: '2026-10-19', uptime: 90, checks: 288 },
    { day: '2026-10-20', uptime: 100, checks: 100 },
  ],
  swaps7d: {
    all: { total: 15, success: 14, failed: 1, avgMs: 6419 },
    asSource: { total: 8, success: 7, failed: 1 },
    asDest: { total: 7, success: 7, failed: 0 },
    errorsBlamed: 0,
  },
  balance: 12345,
};
const fetchMock = jest.fn();
let storage: Record<string, string>;
beforeEach(() => {
  jest.clearAllMocks();
  storage = {};
  jest.mocked(sqliteStorage.getItem).mockImplementation((key) => storage[key] ?? null);
  jest.mocked(sqliteStorage.setItem).mockImplementation((key, value) => {
    storage[key] = value;
  });
  global.fetch = fetchMock;
});
const response = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
});

it('requests the stable MintRadar API and restores its validated report from storage', async () => {
  fetchMock.mockResolvedValueOnce(response(radar));
  expect((await mintHealthService.radar(url))?.score).toBe(98);
  expect(fetchMock).toHaveBeenCalledWith(
    `https://mintradar.org/api/v1/wallets/mints/${encodeURIComponent(url)}`,
    expect.objectContaining({ signal: expect.anything() }),
  );
  expect(mintHealthService.cachedRadar(url)?.data?.score).toBe(98);
  fetchMock.mockResolvedValueOnce(response(null, 502));
  await expect(mintHealthService.radar(url)).rejects.toThrow('502');
  expect(mintHealthService.cachedRadar(url)?.data?.score).toBe(98);
});

it('loads the unfiltered directory including offline, test and unscored mints and persists it', async () => {
  const list = {
    mints: [
      { ...radar.mint, name: 'Example mint', status: 'online', reviews: { count: 2, avg: 4.5 } },
      { url: 'https://test.example', score: null, status: 'offline', isTest: true },
      { url: 'javascript:alert(1)' },
      { url: 'https://user:secret@mint.example' },
    ],
  };
  fetchMock.mockResolvedValueOnce(response(list));
  const result = await mintHealthService.radarList();
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ reviewsCount: 2, averageRating: 4.5 });
  expect(result[1]).toMatchObject({ isTest: true, score: null, status: 'offline' });
  const requested = new URL(fetchMock.mock.calls[0][0]);
  expect(requested.pathname).toBe('/api/v1/wallets/mints');
  for (const flag of ['includeOffline', 'includeArchived', 'includeTest', 'includeUnscored']) {
    expect(requested.searchParams.get(flag)).toBe('true');
  }
  expect(requested.searchParams.get('limit')).toBe('200');
  expect(mintHealthService.cachedRadarList()?.data).toEqual(result);
  expect(() => parseRadarList({})).toThrow('Invalid MintRadar mint list');
});

it('loads the independent auditor and keeps uptime, route failures, and attributed failures separate', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ mints: [summary] }))
    .mockResolvedValueOnce(response(detail));
  const list = await mintHealthService.cashuList();
  const audit = await mintHealthService.cashuDetail(list[0]);
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://cashu.info/api/v1/mints/mint1',
    expect.anything(),
  );
  expect(audit?.uptime['24h']).toBe(100);
  expect(audit?.daily).toEqual(detail.daily);
  expect(audit?.network.country).toBe('US');
  expect(audit?.swaps7d.all).toMatchObject({ total: 15, success: 14, failed: 1 });
  expect(audit?.swaps7d.errorsBlamed).toBe(0);
  expect(audit).not.toHaveProperty('balance');
  expect(mintHealthService.cachedCashuList()?.data).toEqual(list);
  expect(mintHealthService.cachedCashuDetail(url)?.data).toEqual(audit);
});

it('validates and orders daily outage history without inventing uptime for missing checks', () => {
  const audit = parseCashuHealthDetail(
    {
      ...detail,
      daily: [
        { day: '2026-10-20', uptime: 100, checks: 0 },
        { day: '2026-10-18', uptime: 0, checks: 288 },
        { day: '2026-10-19', uptime: 99.5, checks: 288 },
        { day: '2026-10-17', uptime: 101, checks: 288 },
        { day: '2026-02-30', uptime: 100, checks: 288 },
        { day: 'bad', uptime: 100, checks: 288 },
        { day: '2026-10-16', uptime: 100, checks: -1 },
      ],
    },
    url,
  );
  expect(audit.daily).toEqual([
    { day: '2026-10-17', uptime: null, checks: 288 },
    { day: '2026-10-18', uptime: 0, checks: 288 },
    { day: '2026-10-19', uptime: 99.5, checks: 288 },
    { day: '2026-10-20', uptime: null, checks: 0 },
  ]);
  expect(parseCashuHealthDetail({ ...detail, daily: undefined }, url).daily).toEqual([]);
});

it('preserves real zeros, rejects invalid percentages, and never accepts another mint identity', () => {
  expect(
    parseRadarHealth({ mint: { url, score: 0, uptime24hPct: 0, uptime7dPct: 101 } }, url),
  ).toMatchObject({ score: 0, uptime24hPct: 0, uptime7dPct: null });
  expect(() => parseRadarHealth({ mint: { ...radar.mint, url: url.toLowerCase() } }, url)).toThrow(
    'different mint',
  );
  expect(() =>
    parseCashuHealthDetail({ ...detail, url: 'https://mint.example:8443/Bitcoin' }, url),
  ).toThrow('different mint');
  expect(mintHealthUrl('https://MINT.example/Bitcoin/')).toBe(url);
  expect(mintHealthUrl(`${url}?value=/`)).toBe(`${url}?value=/`);
});

it('treats untracked mints and unavailable providers differently', async () => {
  fetchMock.mockResolvedValueOnce(response(null, 404));
  await expect(mintHealthService.radar(url)).resolves.toBeNull();
  expect(mintHealthService.cachedRadar(url)?.data).toBeNull();
  fetchMock.mockResolvedValueOnce(response(null, 503));
  await expect(mintHealthService.cashuList()).rejects.toThrow('503');
  expect(mintHealthService.cachedCashuList()).toBeUndefined();
});

it('does not fabricate payment statistics from inconsistent or absent samples', () => {
  expect(
    parseCashuHealthDetail(
      { ...detail, swaps7d: { all: { total: 1, success: 3, failed: 0 } } },
      url,
    ).swaps7d.all,
  ).toBeNull();
  expect(parseCashuHealthDetail({ ...detail, swaps7d: {} }, url).swaps7d.all).toBeNull();
  expect(parseCashuHealthList({ mints: [{ id: '../bad', url }, summary] })).toHaveLength(1);
});

it('checks mint metadata without registering or trusting a mint', async () => {
  fetchMock.mockResolvedValueOnce(response({ name: 'Example', nuts: {} }));
  await expect(mintHealthService.mintInfo(url)).resolves.toEqual({ name: 'Example', nuts: {} });
  expect(fetchMock).toHaveBeenCalledWith(`${url}/v1/info`, expect.anything());
  fetchMock.mockResolvedValueOnce(response({ name: 'Not a mint' }));
  await expect(mintHealthService.mintInfo(url)).rejects.toThrow('valid Cashu');
});

it('cancels on timeout without replacing the last saved result', async () => {
  jest.useFakeTimers();
  try {
    fetchMock.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        }),
    );
    const result = expect(mintHealthService.radar(url)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await jest.advanceTimersByTimeAsync(8000);
    await result;
    expect(sqliteStorage.setItem).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
