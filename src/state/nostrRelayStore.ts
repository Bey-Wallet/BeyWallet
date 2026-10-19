import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import {
  DEFAULT_NOSTR_RELAYS,
  DEFAULT_NOSTR_INBOX_RELAYS,
  normalizeRelayList,
  normalizeRelayUrl,
} from '~/shared/utils/nostrRelays';

type RelayState = {
  relays: string[];
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  resetRelays: () => void;
};

export const useNostrRelayStore = create<RelayState>()(
  persist(
    (set, get) => ({
      relays: [...DEFAULT_NOSTR_RELAYS],
      addRelay: (value) => {
        const url = normalizeRelayUrl(value);
        if (get().relays.includes(url)) throw new Error('This relay is already in your list.');
        set({ relays: normalizeRelayList([...get().relays, url]) });
      },
      removeRelay: (url) =>
        set({ relays: normalizeRelayList(get().relays.filter((value) => value !== url)) }),
      resetRelays: () => set({ relays: [...DEFAULT_NOSTR_RELAYS] }),
    }),
    {
      name: 'bey-nostr-relays',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ relays }) => ({ relays }),
      merge: (persisted, current) => {
        try {
          return {
            ...current,
            relays: normalizeRelayList((persisted as { relays?: unknown })?.relays),
          };
        } catch {
          return current;
        }
      },
    },
  ),
);

export function getNostrRelays(): string[] {
  return [...useNostrRelayStore.getState().relays];
}

export function getNostrInboxRelays(): string[] {
  const relays = getNostrRelays();
  const defaults =
    relays.length === DEFAULT_NOSTR_RELAYS.length &&
    DEFAULT_NOSTR_RELAYS.every((url) => relays.includes(url));
  return defaults ? [...DEFAULT_NOSTR_INBOX_RELAYS] : relays;
}

export function getNostrQueryRelays(defaults: string[]): string[] {
  const relays = getNostrRelays();
  const unchanged =
    relays.length === DEFAULT_NOSTR_RELAYS.length &&
    DEFAULT_NOSTR_RELAYS.every((url) => relays.includes(url));
  return unchanged ? [...defaults] : relays;
}
