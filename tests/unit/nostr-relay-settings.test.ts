import { useNostrRelayStore, getNostrRelays, getNostrInboxRelays } from '~/state/nostrRelayStore';
import {
  DEFAULT_NOSTR_RELAYS,
  DEFAULT_NOSTR_INBOX_RELAYS,
  normalizeRelayUrl,
} from '~/shared/utils/nostrRelays';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { nostrService } from '~/services/wallet/nostrService';
import { getPublicKey } from 'nostr-tools';

jest.mock('~/storage/sqlite/sqliteStorage', () => {
  const values = new Map<string, string>();
  return {
    sqliteStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  };
});

beforeEach(() => {
  (nostrService as any).isRunning = false;
  useNostrRelayStore.getState().resetRelays();
});
afterEach(() => {
  jest.useRealTimers();
  (nostrService as any).isRunning = false;
  (nostrService as any).pool = null;
  jest.restoreAllMocks();
});

it('bounds mint-backup acknowledgement time without closing the shared messaging pool', async () => {
  jest.useFakeTimers();
  const pool = { publish: jest.fn(() => [new Promise<void>(() => {})]), close: jest.fn() };
  (nostrService as any).pool = pool;
  const fixture = new Uint8Array(32).fill(1);
  const result = nostrService.backupMintsToNostr(
    ['https://mint.example'],
    '01'.repeat(32),
    getPublicKey(fixture),
  );
  await jest.advanceTimersByTimeAsync(15_000);
  expect(await result).toBe(false);
  expect(pool.close).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('validates URLs, canonicalizes duplicates, and prevents removing the final relay', () => {
  expect(normalizeRelayUrl(' WSS://Relay.Example:443/ ')).toBe('wss://relay.example');
  for (const invalid of [
    'https://relay.example',
    'ws://relay.example',
    'wss://user:pass@relay.example',
    'wss://relay.example/#secret',
    'no-url',
  ]) {
    expect(() => useNostrRelayStore.getState().addRelay(invalid)).toThrow();
  }
  useNostrRelayStore.getState().addRelay('wss://custom.example/');
  expect(() => useNostrRelayStore.getState().addRelay('wss://custom.example')).toThrow('already');
  useNostrRelayStore.setState({ relays: ['wss://custom.example'] });
  expect(() => useNostrRelayStore.getState().removeRelay('wss://custom.example')).toThrow(
    'at least one',
  );
});

it('persists edits, validates hydration, and restores the original inbox defaults on reset', async () => {
  useNostrRelayStore.getState().addRelay('wss://custom.example');
  const saved = sqliteStorage.getItem('bey-nostr-relays')!;
  useNostrRelayStore.getState().resetRelays();
  sqliteStorage.setItem('bey-nostr-relays', saved);
  await useNostrRelayStore.persist.rehydrate();
  expect(getNostrRelays()).toContain('wss://custom.example');
  expect(getNostrInboxRelays()).toEqual(getNostrRelays());
  sqliteStorage.setItem(
    'bey-nostr-relays',
    JSON.stringify({ state: { relays: ['ws://unsafe.example'] }, version: 0 }),
  );
  await useNostrRelayStore.persist.rehydrate();
  expect(getNostrRelays()).not.toContain('ws://unsafe.example');
  useNostrRelayStore.getState().resetRelays();
  expect(getNostrRelays()).toEqual(DEFAULT_NOSTR_RELAYS);
  expect(getNostrInboxRelays()).toEqual(DEFAULT_NOSTR_INBOX_RELAYS);
});

it('closes the old relay snapshot, reconnects, and republishes the inbox list after edits', () => {
  const service = nostrService as any;
  const previous = getNostrRelays();
  const close = jest.fn();
  service.connectedRelays = previous;
  service.pool = { close };
  service.isRunning = true;
  const subscribe = jest.spyOn(service, '_subscribe').mockImplementation(() => {});
  const publish = jest.spyOn(service, '_publishInboxRelayList').mockResolvedValue(true);
  useNostrRelayStore.getState().removeRelay(previous[0]);
  expect(close).toHaveBeenCalledWith(previous);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(getNostrRelays()).not.toContain(previous[0]);
});

it('reports actual connection state when the pool normalizes a root URL with a slash', () => {
  useNostrRelayStore.setState({ relays: ['wss://custom.example', 'wss://offline.example'] });
  (nostrService as any).pool = {
    listConnectionStatus: () => new Map([['wss://custom.example/', true]]),
  };
  expect(nostrService.getRelayConnectionStatus()).toEqual({
    'wss://custom.example': true,
    'wss://offline.example': false,
  });
});
