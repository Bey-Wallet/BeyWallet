import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export const NOSTR_HISTORY_SECONDS = 7 * 24 * 60 * 60;
export const GIFT_WRAP_TIMESTAMP_SECONDS = 2 * 24 * 60 * 60;
export const useNostrHistoryStore = create<{
  walletId: string | null;
  restoredAt: number | null;
  includeOlder: boolean;
  beginRestore: (walletId: string, restoredAt: number) => void;
  bindWallet: (walletId: string) => void;
  setIncludeOlder: (includeOlder: boolean) => void;
}>()(
  persist(
    (set, get) => ({
      walletId: null,
      restoredAt: null,
      includeOlder: true,
      beginRestore: (walletId, restoredAt) => set({ walletId, restoredAt, includeOlder: false }),
      bindWallet: (walletId) => {
        if (get().walletId !== walletId) set({ walletId, restoredAt: null, includeOlder: true });
      },
      setIncludeOlder: (includeOlder) =>
        set({
          includeOlder,
          restoredAt:
            !includeOlder && get().restoredAt === null
              ? Math.floor(Date.now() / 1000)
              : get().restoredAt,
        }),
    }),
    {
      name: 'bey-nostr-history',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ walletId, restoredAt, includeOlder }) => ({
        walletId,
        restoredAt,
        includeOlder,
      }),
    },
  ),
);

/** Filter by the authenticated inner message timestamp, not randomized gift-wrap time. */
export function nostrMessageSince(walletId: string, now = Math.floor(Date.now() / 1000)) {
  const history = useNostrHistoryStore.getState();
  const recent = now - NOSTR_HISTORY_SECONDS;
  if (history.walletId !== walletId || history.restoredAt === null || history.includeOlder)
    return recent;
  return Math.max(recent, history.restoredAt);
}
