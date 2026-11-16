import * as SQLite from 'expo-sqlite';
import {
  fileRestoreJournal,
  validateInstalledFileRestore,
} from '~/storage/sqlite/fileRestoreStorage';
import {
  openEncryptedDatabase,
  verifyEncryptedDatabase,
  removeWalletDatabase,
  walletDatabaseExists,
} from '~/storage/sqlite/encryptedDatabase';

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
jest.mock('~/storage/sqlite/encryptedDatabase', () => ({
  walletDatabaseNames: {
    active: 'coco_wallet_encrypted.db',
    original: 'bey_file_restore_original_encrypted.db',
    staged: 'bey_file_restore_staged_encrypted.db',
  },
  walletDatabaseExists: jest.fn(() => true),
  openEncryptedDatabase: jest.fn((name: string) => ({ name, closeAsync: mockClose })),
  verifyEncryptedDatabase: jest.fn(async () => {}),
  removeWalletDatabase: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it('keys both recovery handles before native backup and closes both handles', async () => {
  await fileRestoreJournal.io.copy('original', 'active');
  expect(walletDatabaseExists).toHaveBeenCalledWith('bey_file_restore_original_encrypted.db');
  expect(openEncryptedDatabase).toHaveBeenCalledTimes(2);
  expect(removeWalletDatabase).toHaveBeenCalledWith('coco_wallet_encrypted.db');
  expect(jest.mocked(openEncryptedDatabase).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(removeWalletDatabase).mock.invocationCallOrder[0],
  );
  expect(SQLite.backupDatabaseAsync).toHaveBeenCalledWith({
    sourceDatabase: expect.objectContaining({ name: 'bey_file_restore_original_encrypted.db' }),
    destDatabase: expect.objectContaining({ name: 'coco_wallet_encrypted.db' }),
  });
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('refuses to create an empty rollback source if the original file is missing', async () => {
  jest.mocked(walletDatabaseExists).mockReturnValueOnce(false);
  await expect(fileRestoreJournal.io.copy('original', 'active')).rejects.toThrow('missing');
  expect(openEncryptedDatabase).not.toHaveBeenCalled();
  expect(SQLite.backupDatabaseAsync).not.toHaveBeenCalled();
});

it('closes both native handles after backup fails so recovery can retry', async () => {
  jest.mocked(SQLite.backupDatabaseAsync).mockRejectedValueOnce(new Error('disk full'));
  await expect(fileRestoreJournal.io.copy('staged', 'active')).rejects.toThrow('disk full');
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('preserves the destination if the source fails page authentication or integrity checks', async () => {
  jest.mocked(verifyEncryptedDatabase).mockRejectedValueOnce(new Error('source is damaged'));
  await expect(fileRestoreJournal.io.copy('original', 'active')).rejects.toThrow('damaged');
  expect(removeWalletDatabase).not.toHaveBeenCalled();
  expect(SQLite.backupDatabaseAsync).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
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
