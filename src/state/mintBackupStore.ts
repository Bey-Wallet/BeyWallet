import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export const mintBackupDefaults = {
  automatic: true,
  lastAttemptAt: null as number | null,
  lastPublishedAt: null as number | null,
  lastPublishedMintCount: 0,
};

export const useMintBackupStore = create<{
  automatic: boolean;
  lastAttemptAt: number | null;
  lastPublishedAt: number | null;
  lastPublishedMintCount: number;
  publishing: boolean;
  setAutomatic: (automatic: boolean) => void;
}>()(
  persist(
    (set) => ({
      ...mintBackupDefaults,
      publishing: false,
      setAutomatic: (automatic) => set({ automatic }),
    }),
    {
      name: 'bey-mint-backup',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ automatic, lastAttemptAt, lastPublishedAt, lastPublishedMintCount }) => ({
        automatic,
        lastAttemptAt,
        lastPublishedAt,
        lastPublishedMintCount,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<typeof mintBackupDefaults> | undefined;
        const timestamp = (value: unknown) =>
          typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
        return {
          ...current,
          automatic: typeof data?.automatic === 'boolean' ? data.automatic : true,
          lastAttemptAt: timestamp(data?.lastAttemptAt),
          lastPublishedAt: timestamp(data?.lastPublishedAt),
          lastPublishedMintCount:
            Number.isSafeInteger(data?.lastPublishedMintCount) &&
            (data?.lastPublishedMintCount ?? 0) >= 0
              ? data!.lastPublishedMintCount!
              : 0,
        };
      },
    },
  ),
);
