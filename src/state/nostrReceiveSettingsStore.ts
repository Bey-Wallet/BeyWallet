import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export type NostrReceivePolicy = 'ask' | 'everyone';

export const useNostrReceiveSettingsStore = create<{
  policy: NostrReceivePolicy;
  setPolicy: (policy: NostrReceivePolicy) => void;
}>()(
  persist((set) => ({ policy: 'ask', setPolicy: (policy) => set({ policy }) }), {
    name: 'bey-nostr-receive-settings',
    storage: createJSONStorage(() => sqliteStorage),
    partialize: ({ policy }) => ({ policy }),
  }),
);
