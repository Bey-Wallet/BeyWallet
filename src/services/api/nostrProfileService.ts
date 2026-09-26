import { Buffer } from 'buffer';
import { nip19, SimplePool, type Event, type Filter } from 'nostr-tools';

export interface NostrProfile {
  pubkeyHex: string;
  npub: string;
  name?: string;
  displayName?: string;
  nip05?: string;
  nip05Verified?: boolean;
  picture?: string;
  about?: string;
  source: 'identifier' | 'nip05' | 'bey' | 'relay';
}

const SEARCH_RELAYS = [
  'wss://relay.nostr.band',
  'wss://relay.noswhere.com',
  'wss://relay.primal.net',
];

const PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  ...SEARCH_RELAYS,
];

const QUERY_TIMEOUT_MS = 5500;
const DIRECTORY_CACHE_MS = 5 * 60 * 1000;

let beyDirectoryCache: { names: Record<string, string>; fetchedAt: number } | null = null;

function asText(value: unknown, maxLength = 280): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

function decodedPubkeyToHex(value: unknown): string | null {
  if (typeof value === 'string') return value.toLowerCase();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex').toLowerCase();
  return null;
}

function normalizeHex(value: string): string | null {
  const hex = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

function profileFromPubkey(pubkeyHex: string, source: NostrProfile['source']): NostrProfile {
  return {
    pubkeyHex,
    npub: nip19.npubEncode(pubkeyHex),
    source,
  };
}

export function parseNostrProfileEvent(event: Event): NostrProfile | null {
  const pubkeyHex = normalizeHex(event.pubkey);
  if (!pubkeyHex || event.kind !== 0) return null;

  try {
    const metadata = JSON.parse(event.content) as Record<string, unknown>;
    const profile = profileFromPubkey(pubkeyHex, 'relay');
    return {
      ...profile,
      name: asText(metadata.name, 80),
      displayName: asText(metadata.display_name ?? metadata.displayName, 100),
      nip05: asText(metadata.nip05, 200),
      picture: asText(metadata.picture, 1000),
      about: asText(metadata.about, 500),
    };
  } catch {
    return null;
  }
}

export function decodeNostrPublicKey(input: string): string | null {
  const cleaned = input.trim().replace(/^nostr:/i, '');
  const directHex = normalizeHex(cleaned);
  if (directHex) return directHex;

  try {
    const decoded = nip19.decode(cleaned);
    if (decoded.type === 'npub') return normalizeHex(decodedPubkeyToHex(decoded.data) || '');
    if (decoded.type === 'nprofile') return normalizeHex(decoded.data.pubkey);
  } catch {
    // Not an exact NIP-19 public-key identifier.
  }

  return null;
}

function mergeNewestEvents(events: Event[]): NostrProfile[] {
  const newestByAuthor = new Map<string, Event>();

  for (const event of events) {
    if (event.kind !== 0) continue;
    const current = newestByAuthor.get(event.pubkey);
    if (!current || event.created_at > current.created_at) newestByAuthor.set(event.pubkey, event);
  }

  return Array.from(newestByAuthor.values())
    .map(parseNostrProfileEvent)
    .filter((profile): profile is NostrProfile => profile !== null);
}

async function queryProfiles(filter: Filter): Promise<NostrProfile[]> {
  const pool = new SimplePool();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const query = pool.querySync(SEARCH_RELAYS, filter);
    const events = await Promise.race([
      query,
      new Promise<Event[]>((resolve) => {
        timeout = setTimeout(() => resolve([]), QUERY_TIMEOUT_MS);
      }),
    ]);
    return mergeNewestEvents(events);
  } finally {
    if (timeout) clearTimeout(timeout);
    pool.close(SEARCH_RELAYS);
  }
}

async function fetchProfile(pubkeyHex: string): Promise<NostrProfile | null> {
  const pool = new SimplePool();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const query = pool.querySync(PROFILE_RELAYS, {
      kinds: [0],
      authors: [pubkeyHex],
      limit: 8,
    });
    const events = await Promise.race([
      query,
      new Promise<Event[]>((resolve) => {
        timeout = setTimeout(() => resolve([]), QUERY_TIMEOUT_MS);
      }),
    ]);
    return mergeNewestEvents(events)[0] || null;
  } finally {
    if (timeout) clearTimeout(timeout);
    pool.close(PROFILE_RELAYS);
  }
}

async function fetchBeyDirectory(): Promise<Record<string, string>> {
  if (beyDirectoryCache && Date.now() - beyDirectoryCache.fetchedAt < DIRECTORY_CACHE_MS) {
    return beyDirectoryCache.names;
  }

  const response = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
  if (!response.ok) throw new Error(`Bey directory returned ${response.status}`);
  const payload = (await response.json()) as { names?: Record<string, string> };
  const names = payload.names || {};
  beyDirectoryCache = { names, fetchedAt: Date.now() };
  return names;
}

async function resolveNip05(identifier: string): Promise<NostrProfile | null> {
  const normalized = identifier.trim().replace(/^@/, '').toLowerCase();
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) return null;

  const name = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  if (!/^[a-z0-9._-]+$/.test(name) || !/^[a-z0-9.-]+$/.test(domain)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`,
      { signal: controller.signal, redirect: 'error' },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { names?: Record<string, string> };
    const pubkeyHex = normalizeHex(payload.names?.[name] || '');
    if (!pubkeyHex) return null;

    const metadata = await fetchProfile(pubkeyHex).catch(() => null);
    return {
      ...(metadata || profileFromPubkey(pubkeyHex, 'nip05')),
      nip05: normalized,
      nip05Verified: true,
      source: 'nip05',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function searchBeyDirectory(query: string, names: Record<string, string>): NostrProfile[] {
  const lowerQuery = query.toLowerCase();
  const results: NostrProfile[] = [];

  for (const [name, value] of Object.entries(names)) {
    if (!name.toLowerCase().includes(lowerQuery)) continue;
    const pubkeyHex = normalizeHex(value);
    if (!pubkeyHex) continue;
    results.push({
      ...profileFromPubkey(pubkeyHex, 'bey'),
      name,
      nip05: `${name}@bey.cash`,
      nip05Verified: true,
    });
    if (results.length >= 12) break;
  }

  return results;
}

function dedupeProfiles(profiles: NostrProfile[]): NostrProfile[] {
  const byPubkey = new Map<string, NostrProfile>();

  for (const profile of profiles) {
    const current = byPubkey.get(profile.pubkeyHex);
    if (!current) {
      byPubkey.set(profile.pubkeyHex, profile);
      continue;
    }

    byPubkey.set(profile.pubkeyHex, {
      ...current,
      ...profile,
      nip05: profile.nip05Verified ? profile.nip05 : current.nip05 || profile.nip05,
      nip05Verified: current.nip05Verified || profile.nip05Verified,
    });
  }

  return Array.from(byPubkey.values());
}

export const nostrProfileService = {
  async search(query: string): Promise<NostrProfile[]> {
    const cleaned = query.trim().replace(/^nostr:/i, '');
    if (!cleaned) return [];

    const exactPubkey = decodeNostrPublicKey(cleaned);
    if (exactPubkey) {
      const metadata = await fetchProfile(exactPubkey).catch(() => null);
      return [metadata || profileFromPubkey(exactPubkey, 'identifier')];
    }

    if (cleaned.includes('@')) {
      const nip05Profile = await resolveNip05(cleaned).catch(() => null);
      return nip05Profile ? [nip05Profile] : [];
    }

    if (cleaned.length < 2) return [];

    const [relayResult, directoryResult] = await Promise.allSettled([
      queryProfiles({ kinds: [0], search: cleaned, limit: 24 } as Filter),
      fetchBeyDirectory(),
    ]);

    const relayProfiles = relayResult.status === 'fulfilled' ? relayResult.value : [];
    const beyProfiles =
      directoryResult.status === 'fulfilled'
        ? searchBeyDirectory(cleaned, directoryResult.value)
        : [];

    return dedupeProfiles([...beyProfiles, ...relayProfiles]).slice(0, 24);
  },
};
