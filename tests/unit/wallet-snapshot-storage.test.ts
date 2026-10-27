import { sqliteStorage, closeDb, invalidateWalletSnapshot } from '~/storage/sqlite/sqliteStorage';
const mockRun = jest.fn();
const mockRead = jest.fn();
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    runSync: mockRun,
    getFirstSync: mockRead,
    closeSync: jest.fn(),
  }),
}));
beforeEach(() => {
  closeDb();
  mockRun.mockReset();
  mockRead.mockReset();
});

it('persists changed snapshots immediately and skips unchanged progress-triggered writes', () => {
  sqliteStorage.setItem('wallet-storage', 'first');
  sqliteStorage.setItem('wallet-storage', 'first');
  expect(mockRun).toHaveBeenCalledTimes(1);
  sqliteStorage.setItem('wallet-storage', 'second');
  expect(mockRun).toHaveBeenCalledTimes(2);
  invalidateWalletSnapshot();
  sqliteStorage.setItem('wallet-storage', 'second');
  expect(mockRun).toHaveBeenCalledTimes(3);
});

it('never caches failed writes and invalidates on deletion and database close', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockRun.mockImplementationOnce(() => {
    throw new Error('busy');
  });
  expect(() => sqliteStorage.setItem('wallet-storage', 'a')).toThrow('busy');
  sqliteStorage.setItem('wallet-storage', 'a');
  sqliteStorage.removeItem('wallet-storage');
  sqliteStorage.setItem('wallet-storage', 'a');
  closeDb();
  sqliteStorage.setItem('wallet-storage', 'a');
  expect(mockRun).toHaveBeenCalledTimes(5);
  warn.mockRestore();
});

it('uses persisted values after restart and leaves other storage keys uncached', () => {
  mockRead.mockReturnValue({ value: 'saved' });
  expect(sqliteStorage.getItem('wallet-storage')).toBe('saved');
  sqliteStorage.setItem('wallet-storage', 'saved');
  expect(mockRun).not.toHaveBeenCalled();
  sqliteStorage.setItem('other', 'same');
  sqliteStorage.setItem('other', 'same');
  expect(mockRun).toHaveBeenCalledTimes(2);
});
