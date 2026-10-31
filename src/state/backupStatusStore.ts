import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export const backupStatusDefaults = {
  phraseConfirmedAt: null as number | null,
  fileExportedAt: null as number | null,
  fileExportMethod: null as 'saved' | 'share-sheet' | null,
};
export const useBackupStatusStore = create<
  typeof backupStatusDefaults & {
    recordPhrase: (confirmed: boolean) => void;
    recordFile: (method: 'saved' | 'share-sheet') => void;
  }
>()(
  persist(
    (set) => ({
      ...backupStatusDefaults,
      recordPhrase: (confirmed) => set({ phraseConfirmedAt: confirmed ? Date.now() : null }),
      recordFile: (method) => set({ fileExportedAt: Date.now(), fileExportMethod: method }),
    }),
    {
      name: 'bey-backup-status',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: ({ phraseConfirmedAt, fileExportedAt, fileExportMethod }) => ({
        phraseConfirmedAt,
        fileExportedAt,
        fileExportMethod,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<typeof backupStatusDefaults> | null;
        const time = (value: unknown) =>
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value > 0 &&
          Number.isFinite(new Date(value).getTime())
            ? value
            : null;
        return {
          ...current,
          phraseConfirmedAt: time(data?.phraseConfirmedAt),
          fileExportedAt: time(data?.fileExportedAt),
          fileExportMethod:
            data?.fileExportMethod === 'saved' || data?.fileExportMethod === 'share-sheet'
              ? data.fileExportMethod
              : null,
        };
      },
    },
  ),
);
