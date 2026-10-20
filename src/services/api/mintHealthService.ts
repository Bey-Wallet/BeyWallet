import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const percent = (value: unknown) => {
  const n = number(value);
  return n !== null && n <= 100 ? n : null;
};
const count = (value: unknown) => {
  const n = number(value);
  return n !== null && Number.isSafeInteger(n) ? n : null;
};
const date = (value: unknown) => {
  const s = text(value);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};

/** Keep paths, ports and schemes significant when matching a provider's mint. */
export function mintHealthUrl(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid mint URL');
  url.hash = '';
  return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
}
const matches = (a: unknown, b: string) => {
  try {
    return typeof a === 'string' && mintHealthUrl(a) === mintHealthUrl(b);
  } catch {
    return false;
  }
};

export interface RadarHealth {
  url: string;
  score: number | null;
  scoreCappedNew: boolean;
  isTest: boolean;
  status: string | null;
  uptime24hPct: number | null;
  uptime7dPct: number | null;
  lastCheckedAt: string | null;
}
export interface RadarDiscoveryMint extends RadarHealth {
  name: string | null;
  reviewsCount: number;
  averageRating: number | null;
}
export interface CashuHealthMint {
  id: string;
  url: string;
  isTest: boolean;
  lastCheck: string | null;
  uptime24h: number | null;
  uptime7d: number | null;
}
export interface PaymentTestStats {
  total: number;
  success: number;
  failed: number;
  avgMs: number | null;
}
export interface CashuHealthDetail {
  id: string;
  url: string;
  network: { country: string | null };
  uptime: { '24h': number | null; '7d': number | null; '30d': number | null };
  swaps7d: {
    all: PaymentTestStats | null;
    asSource: PaymentTestStats | null;
    asDest: PaymentTestStats | null;
    errorsBlamed: number | null;
  };
}
export interface CachedHealth<T> {
  data: T;
  savedAt: number;
}

export function parseRadarHealth(value: unknown, url: string): RadarHealth {
  const mint = record(record(value).mint);
  if (!matches(mint.url, url)) throw new Error('MintRadar returned a different mint');
  return {
    url: mintHealthUrl(url),
    score: percent(mint.score),
    scoreCappedNew: mint.scoreCappedNew === true,
    isTest: mint.isTest === true,
    status: text(mint.status),
    uptime24hPct: percent(mint.uptime24hPct),
    uptime7dPct: percent(mint.uptime7dPct),
    lastCheckedAt: date(mint.lastCheckedAt),
  };
}
export function parseRadarList(value: unknown): RadarDiscoveryMint[] {
  const list = record(value).mints;
  if (!Array.isArray(list)) throw new Error('Invalid MintRadar mint list');
  return list.flatMap((raw) => {
    const mint = record(raw);
    const url = text(mint.url);
    if (!url) return [];
    try {
      const reviews = record(mint.reviews);
      const rating = number(reviews.avg);
      return [
        {
          ...parseRadarHealth({ mint }, url),
          name: text(mint.name),
          reviewsCount: count(reviews.count) ?? 0,
          averageRating: rating !== null && rating <= 5 ? rating : null,
        },
      ];
    } catch {
      return [];
    }
  });
}
export function parseCashuHealthList(value: unknown): CashuHealthMint[] {
  const list = record(value).mints;
  if (!Array.isArray(list)) throw new Error('Invalid cashu.info mint list');
  return list.flatMap((raw) => {
    const mint = record(raw);
    const id = text(mint.id);
    const url = text(mint.url);
    if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !url) return [];
    try {
      return [
        {
          id,
          url: mintHealthUrl(url),
          isTest: mint.isTest === true,
          lastCheck: date(mint.lastCheck),
          uptime24h: percent(mint.uptime24h),
          uptime7d: percent(mint.uptime7d),
        },
      ];
    } catch {
      return [];
    }
  });
}
function parseTests(value: unknown): PaymentTestStats | null {
  const stats = record(value);
  const total = count(stats.total),
    success = count(stats.success),
    failed = count(stats.failed);
  if (total === null || success === null || failed === null || success + failed > total)
    return null;
  return { total, success, failed, avgMs: number(stats.avgMs) };
}
export function parseCashuHealthDetail(value: unknown, url: string): CashuHealthDetail {
  const detail = record(value);
  if (!matches(detail.url, url) || !text(detail.id))
    throw new Error('cashu.info returned a different mint');
  const uptime = record(detail.uptime),
    swaps = record(detail.swaps7d);
  const country = text(record(detail.network).country)?.toUpperCase();
  return {
    id: String(detail.id),
    url: mintHealthUrl(url),
    network: { country: country && /^[A-Z]{2}$/.test(country) ? country : null },
    uptime: {
      '24h': percent(uptime['24h']),
      '7d': percent(uptime['7d']),
      '30d': percent(uptime['30d']),
    },
    swaps7d: {
      all: parseTests(swaps.all),
      asSource: parseTests(swaps.asSource),
      asDest: parseTests(swaps.asDest),
      errorsBlamed: count(swaps.errorsBlamed),
    },
  };
}

const key = (source: string, url = '') => `mint-health-v1:${source}:${url}`;
function read<T>(cacheKey: string, parse: (raw: unknown) => T): CachedHealth<T> | undefined {
  try {
    const saved = record(JSON.parse(sqliteStorage.getItem(cacheKey) || 'null'));
    if (typeof saved.savedAt !== 'number' || !Number.isFinite(saved.savedAt) || saved.savedAt <= 0)
      return;
    return { data: parse(saved.data), savedAt: Math.min(saved.savedAt, Date.now()) };
  } catch {
    return;
  }
}
function save(cacheKey: string, data: unknown) {
  sqliteStorage.setItem(cacheKey, JSON.stringify({ data, savedAt: Date.now() }));
}
async function request(url: string, signal?: AbortSignal): Promise<unknown | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Monitoring service returned ${response.status}`);
    const data = await response.json();
    if (controller.signal.aborted)
      throw Object.assign(new Error('Request cancelled'), { name: 'AbortError' });
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export const mintHealthService = {
  cachedRadarList() {
    return read(key('radar-list'), parseRadarList);
  },
  async radarList(signal?: AbortSignal) {
    const raw = await request(
      'https://mintradar.org/api/v1/wallets/mints?includeOffline=true&includeArchived=true&includeTest=true&includeUnscored=true&limit=200',
      signal,
    );
    const data = parseRadarList(raw);
    save(key('radar-list'), {
      mints: data.map(({ reviewsCount, averageRating, ...mint }) => ({
        ...mint,
        reviews: { count: reviewsCount, avg: averageRating },
      })),
    });
    return data;
  },
  async mintInfo(url: string, signal?: AbortSignal) {
    const data = record(await request(`${mintHealthUrl(url)}/v1/info`, signal));
    if (!data.nuts || typeof data.nuts !== 'object' || Array.isArray(data.nuts)) {
      throw new Error('Mint did not return valid Cashu information');
    }
    return data;
  },
  cachedRadar(url: string) {
    return read(key('radar', mintHealthUrl(url)), (raw) =>
      raw === null ? null : parseRadarHealth(raw, url),
    );
  },
  async radar(url: string, signal?: AbortSignal) {
    const canonical = mintHealthUrl(url);
    const raw = await request(
      `https://mintradar.org/api/v1/wallets/mints/${encodeURIComponent(canonical)}`,
      signal,
    );
    const data = raw === null ? null : parseRadarHealth(raw, canonical);
    save(key('radar', canonical), data ? { mint: data } : null);
    return data;
  },
  cachedCashuList() {
    return read(key('cashu-list'), parseCashuHealthList);
  },
  async cashuList(signal?: AbortSignal) {
    const data = parseCashuHealthList(await request('https://cashu.info/api/v1/mints', signal));
    save(key('cashu-list'), { mints: data });
    return data;
  },
  cachedCashuDetail(url: string) {
    return read(key('cashu-detail', mintHealthUrl(url)), (raw) =>
      raw === null ? null : parseCashuHealthDetail(raw, url),
    );
  },
  async cashuDetail(mint: CashuHealthMint, signal?: AbortSignal) {
    const raw = await request(
      `https://cashu.info/api/v1/mints/${encodeURIComponent(mint.id)}`,
      signal,
    );
    const data = raw === null ? null : parseCashuHealthDetail(raw, mint.url);
    save(key('cashu-detail', mint.url), data);
    return data;
  },
};
