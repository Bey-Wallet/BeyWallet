import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  fileRestoreJournal,
  validateInstalledFileRestore,
} from '~/storage/sqlite/fileRestoreStorage';

const mockClose = jest.fn();
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/data/app/SQLite',
  openDatabaseAsync: jest.fn(async (name: string) => ({ name, closeAsync: mockClose })),
  backupDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ closeDb: jest.fn() }));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));

beforeEach(() => jest.clearAllMocks());

it('uses native SQLite backup with a file URI existence check and closes both handles', async () => {
  await fileRestoreJournal.io.copy('original', 'active');
  expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
    'file:///data/app/SQLite/bey_file_restore_original.db',
  );
  expect(SQLite.backupDatabaseAsync).toHaveBeenCalledWith({
    sourceDatabase: expect.objectContaining({ name: 'bey_file_restore_original.db' }),
    destDatabase: expect.objectContaining({ name: 'coco_wallet.db' }),
  });
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('refuses to create an empty rollback source if the original file is missing', async () => {
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockResolvedValueOnce({ exists: false, uri: 'fixture', isDirectory: false });
  await expect(fileRestoreJournal.io.copy('original', 'active')).rejects.toThrow('missing');
  expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
  expect(SQLite.backupDatabaseAsync).not.toHaveBeenCalled();
});

it('closes both native handles after backup fails so recovery can retry', async () => {
  jest.mocked(SQLite.backupDatabaseAsync).mockRejectedValueOnce(new Error('disk full'));
  await expect(fileRestoreJournal.io.copy('staged', 'active')).rejects.toThrow('disk full');
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('rejects a missing, unrelated or corrupted installed database before deleting the original snapshot', async () => {
  const record = { restoreId: 'restore-fixture' } as any;
  for (const value of [null, { value: 'different-installation' }]) {
    const database = { getFirstAsync: jest.fn(async () => value) } as any;
    await expect(validateInstalledFileRestore(record, database)).rejects.toThrow('does not match');
  }
  const database = {
    getFirstAsync: jest
      .fn()
      .mockResolvedValueOnce({ value: 'restore-fixture' })
      .mockResolvedValueOnce({ quick_check: 'corrupt' }),
  } as any;
  await expect(validateInstalledFileRestore(record, database)).rejects.toThrow('integrity');
});
