import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useBackupStatusStore, backupStatusDefaults } from '~/state/backupStatusStore';
import { BackupStatusScreen } from '~/features/settings/BackupStatusScreen';
let mockConfirmed = false;
let mockPublished: number | null = null;
const mockStorage = new Map<string, string>();
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ seedBackedUp: mockConfirmed }),
}));
jest.mock('~/state/mintBackupStore', () => ({
  useMintBackupStore: () => ({ lastPublishedAt: mockPublished, lastPublishedMintCount: 2 }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsDescription: 'Description',
  SettingsGroup: 'Group',
  SettingsPage: 'Page',
  SettingsRow: 'Row',
}));
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  useBackupStatusStore.setState({ ...backupStatusDefaults });
  mockConfirmed = false;
  mockPublished = null;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});
it('stores only status metadata and rejects corrupt persisted timestamps', async () => {
  useBackupStatusStore.getState().recordPhrase(true);
  useBackupStatusStore.getState().recordFile('saved');
  const saved = JSON.parse(mockStorage.get('bey-backup-status')!);
  expect(Object.keys(saved.state).sort()).toEqual([
    'fileExportMethod',
    'fileExportedAt',
    'phraseConfirmedAt',
  ]);
  expect(saved.state.fileExportedAt).toBeGreaterThan(0);
  mockStorage.set(
    'bey-backup-status',
    JSON.stringify({
      state: { phraseConfirmedAt: 'invalid', fileExportedAt: -5, fileExportMethod: 'unknown' },
      version: 0,
    }),
  );
  await useBackupStatusStore.persist.rehydrate();
  expect(useBackupStatusStore.getState()).toMatchObject(backupStatusDefaults);
});
it('does not invent dates for legacy phrase confirmations or claim that sharing saved a file', async () => {
  mockConfirmed = true;
  useBackupStatusStore.getState().recordFile('share-sheet');
  await act(async () => {
    tree = create(<BackupStatusScreen />);
  });
  const rows = tree!.root.findAllByType('Row' as any);
  expect(rows[0].props).toMatchObject({ value: 'Confirmed', description: 'Date not recorded' });
  expect(rows[1].props.value).toBe('Save not verified');
  expect(rows[2].props.value).toBe('Not recorded');
  expect(rows.slice(0, 3).every((row) => !row.props.onPress)).toBe(true);
});
it('shows confirmed file saves and successful mint publication dates', async () => {
  useBackupStatusStore.getState().recordFile('saved');
  mockPublished = Date.now();
  await act(async () => {
    tree = create(<BackupStatusScreen />);
  });
  const rows = tree!.root.findAllByType('Row' as any);
  expect(rows[1].props.value).toBe('Saved');
  expect(rows[2].props).toMatchObject({
    value: 'Published',
    description: expect.stringContaining('2 mints'),
  });
});
