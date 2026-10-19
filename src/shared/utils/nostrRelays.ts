export const DEFAULT_NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.minibits.cash',
  'wss://nostr.oxtr.dev',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://relay.noswhere.com',
  'wss://nostr.bitcoiner.social',
  'wss://relay.current.fyi',
  'wss://relay.8333.space',
];

export const DEFAULT_NOSTR_INBOX_RELAYS = [
  'wss://relay.minibits.cash',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

export function normalizeRelayUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid secure relay URL, such as wss://relay.example.');
  }
  if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.hash) {
    throw new Error('Use a wss:// URL without credentials or a fragment.');
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+/g, '/');
  if (url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  url.searchParams.sort();
  return url.toString().replace(/\/$/, '');
}

export function normalizeRelayList(values: unknown): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new Error('Relay settings must contain relay URLs.');
  }
  const relays = [...new Set(values.map(normalizeRelayUrl))];
  if (!relays.length) throw new Error('Keep at least one relay, or reset to defaults.');
  if (relays.length > 32) throw new Error('You can configure up to 32 relays.');
  return relays;
}
