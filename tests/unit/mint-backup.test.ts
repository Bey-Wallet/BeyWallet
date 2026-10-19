import { publishMintBackup, resetMintBackup } from '~/services/wallet/mintBackupService';
import { useMintBackupStore, mintBackupDefaults } from '~/state/mintBackupStore';

const mockPublish = jest.fn();
const mockOffline = jest.fn();
const mockTrusted = jest.fn();
const mockBalances = jest.fn();
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { backupMintsToNostr: (...args: unknown[]) => mockPublish(...args) },
}));
jest.mock('~/services/wallet/mintManager', () => ({
  mintManager: { getAllTrustedMints: () => mockTrusted() },
}));
jest.mock('~/services/wallet/walletService', () => ({
  walletService: { getBalances: () => mockBalances() },
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: () => mockOffline() },
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: jest.fn(async () => 'test-fixture'),
    getNostrKeys: jest.fn(async () => ({ privkey: 'fixture-key', pubkey: 'fixture-public-key' })),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetMintBackup();
  useMintBackupStore.setState({ ...mintBackupDefaults, publishing: false });
  mockOffline.mockResolvedValue(false);
  mockPublish.mockResolvedValue(true);
  mockTrusted.mockResolvedValue([{ mintUrl: 'https://a.test' }, { mintUrl: 'https://a.test' }]);
  mockBalances.mockResolvedValue({
    'https://a.test': 10,
    'https://b.test': 20,
    'https://empty.test': 0,
  });
});

it('deduplicates mint URLs, includes untrusted mints with funds, and records confirmed publication', async () => {
  expect(await publishMintBackup()).toBe('published');
  expect(mockPublish).toHaveBeenCalledWith(
    ['https://a.test', 'https://b.test'],
    'fixture-key',
    'fixture-public-key',
  );
  expect(useMintBackupStore.getState()).toMatchObject({
    publishing: false,
    lastPublishedMintCount: 2,
  });
  expect(useMintBackupStore.getState().lastAttemptAt).toEqual(expect.any(Number));
  expect(useMintBackupStore.getState().lastPublishedAt).toEqual(expect.any(Number));
});

it('honors automatic backup being off but allows manual backup', async () => {
  useMintBackupStore.getState().setAutomatic(false);
  expect(await publishMintBackup(true)).toBe('disabled');
  expect(mockPublish).not.toHaveBeenCalled();
  expect(await publishMintBackup()).toBe('published');
});

it('does not report a new successful timestamp when relays reject publication', async () => {
  useMintBackupStore.setState({ lastPublishedAt: 123 });
  mockPublish.mockResolvedValue(false);
  expect(await publishMintBackup()).toBe('failed');
  expect(useMintBackupStore.getState().lastPublishedAt).toBe(123);
  expect(useMintBackupStore.getState().lastAttemptAt).toEqual(expect.any(Number));
});

it('skips offline and empty backups without claiming they were published', async () => {
  mockOffline.mockResolvedValueOnce(true);
  expect(await publishMintBackup()).toBe('offline');
  mockTrusted.mockResolvedValue([]);
  mockBalances.mockResolvedValue({});
  expect(await publishMintBackup()).toBe('empty');
  expect(mockPublish).not.toHaveBeenCalled();
  expect(useMintBackupStore.getState().lastPublishedAt).toBeNull();
});

it('joins overlapping automatic/manual requests and does not write old-wallet results after reset', async () => {
  let finish!: (value: boolean) => void;
  mockPublish.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const job = publishMintBackup(true);
  const joined = publishMintBackup();
  expect(joined).toBe(job);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(mockPublish).toHaveBeenCalledTimes(1);
  resetMintBackup();
  useMintBackupStore.setState({ ...mintBackupDefaults, publishing: false });
  finish(true);
  expect(await job).toBe('failed');
  expect(useMintBackupStore.getState().lastPublishedAt).toBeNull();
});
