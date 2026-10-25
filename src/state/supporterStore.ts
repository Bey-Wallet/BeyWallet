import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

/** Only a local UI preference is stored; this is not a membership entitlement. */
export const useSupporterStore = create<{
  homeCardDismissed: boolean;
  dismissHomeCard: () => void;
}>()(
  persist(
    (set) => ({
      homeCardDismissed: false,
      dismissHomeCard: () => set({ homeCardDismissed: true }),
    }),
    {
      name: 'bey-supporter-ui-preferences',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ homeCardDismissed }) => ({ homeCardDismissed }),
    },
  ),
);
