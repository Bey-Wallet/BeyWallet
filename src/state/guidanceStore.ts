import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export type GuidanceTopic = 'recovery' | 'offlineTokens' | 'mintTrust';
const topics: GuidanceTopic[] = ['recovery', 'offlineTokens', 'mintTrust'];

interface GuidanceState {
  dismissed: GuidanceTopic[];
  dismiss: (topic: GuidanceTopic) => void;
}

export const useGuidanceStore = create<GuidanceState>()(
  persist(
    (set) => ({
      dismissed: [],
      dismiss: (topic) =>
        set((state) => ({ dismissed: [...new Set([...state.dismissed, topic])] })),
    }),
    {
      name: 'bey-first-use-guidance',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ dismissed }) => ({ dismissed }),
      merge: (persisted, current) => {
        const saved = (persisted as { dismissed?: unknown })?.dismissed;
        return {
          ...current,
          dismissed: Array.isArray(saved) ? topics.filter((topic) => saved.includes(topic)) : [],
        };
      },
    },
  ),
);
