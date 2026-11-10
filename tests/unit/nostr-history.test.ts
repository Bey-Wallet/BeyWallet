import {
  nostrMessageSince,
  NOSTR_HISTORY_SECONDS,
  useNostrHistoryStore,
} from '~/state/nostrHistoryStore';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const now = 2000000;
beforeEach(() => {
  jest.mocked(sqliteStorage.getItem).mockReturnValue(null);
  useNostrHistoryStore.setState({ walletId: null, restoredAt: null, includeOlder: true });
});
it('seed restore defaults to its cutoff and explicit opt-in restores the seven-day window', () => {
  useNostrHistoryStore.getState().beginRestore('wallet', now);
  expect(nostrMessageSince('wallet', now + 60)).toBe(now);
  useNostrHistoryStore.getState().setIncludeOlder(true);
  expect(nostrMessageSince('wallet', now + 60)).toBe(now + 60 - NOSTR_HISTORY_SECONDS);
  useNostrHistoryStore.getState().setIncludeOlder(false);
  expect(nostrMessageSince('wallet', now + 60)).toBe(now);
});
it('retains the cutoff on reconnect and never carries it into a different identity', () => {
  useNostrHistoryStore.getState().beginRestore('wallet', now);
  useNostrHistoryStore.getState().bindWallet('wallet');
  expect(useNostrHistoryStore.getState().includeOlder).toBe(false);
  expect(nostrMessageSince('wallet', now + 60)).toBe(now);
  useNostrHistoryStore.getState().bindWallet('other');
  expect(nostrMessageSince('other', now)).toBe(now - NOSTR_HISTORY_SECONDS);
});
it('never silently broadens an old restore cutoff beyond the normal catch-up window', () => {
  useNostrHistoryStore.getState().beginRestore('wallet', 1);
  expect(nostrMessageSince('wallet', now)).toBe(now - NOSTR_HISTORY_SECONDS);
});
it('persists the identity and restore cutoff, with older loading off', () => {
  useNostrHistoryStore.getState().beginRestore('wallet', now);
  const calls = jest.mocked(sqliteStorage.setItem).mock.calls;
  const value = JSON.parse(calls.at(-1)![1]);
  expect(value.state).toEqual({ walletId: 'wallet', restoredAt: now, includeOlder: false });
});
it('keeps older loading off after storage hydration and listener startup', async () => {
  jest.mocked(sqliteStorage.getItem).mockReturnValue(
    JSON.stringify({
      state: { walletId: 'wallet', restoredAt: now, includeOlder: false },
      version: 0,
    }),
  );
  await useNostrHistoryStore.persist.rehydrate();
  useNostrHistoryStore.getState().bindWallet('wallet');
  expect(useNostrHistoryStore.getState().includeOlder).toBe(false);
  expect(nostrMessageSince('wallet', now + 60)).toBe(now);
});
it('requires a new manual opt-in on every seed restore, even for the same identity', () => {
  useNostrHistoryStore.getState().beginRestore('wallet', now);
  useNostrHistoryStore.getState().setIncludeOlder(true);
  useNostrHistoryStore.getState().beginRestore('wallet', now + 60);
  expect(useNostrHistoryStore.getState().includeOlder).toBe(false);
  expect(nostrMessageSince('wallet', now + 120)).toBe(now + 60);
});
