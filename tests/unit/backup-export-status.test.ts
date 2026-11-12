import { walletFileService } from '~/services/platform/walletFileService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
let mockPlatform = 'android';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
jest.mock('bip39', () => ({ validateMnemonic: () => true }));
jest.mock('expo-document-picker', () => ({}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ backupDirectoryUri: 'content://backups', setBackupDirectoryUri: jest.fn() }),
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'cache/',
  writeAsStringAsync: jest.fn(),
  StorageAccessFramework: { createFileAsync: jest.fn(async () => 'content://backup-file') },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(),
}));
const options = {
  mints: [],
  keysets: [],
  proofs: [],
  counters: [],
  history: [],
  mintQuotes: [],
  secondaryCurrency: 'USD',
  theme: 'dark' as const,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform = 'android';
  jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined);
});
it('returns the backup filename after writing directly', async () => {
  const filename = await walletFileService.exportWallet('synthetic-test-material', options);
  expect(filename).toEqual(expect.any(String));
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    'content://backup-file',
    expect.any(String),
    { encoding: 'utf8' },
  );
});
it('rejects a failed file write', async () => {
  jest
    .mocked(FileSystem.writeAsStringAsync)
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(
    walletFileService.exportWallet('synthetic-test-material', options),
  ).rejects.toThrow();
});
it('uses the share sheet on iOS', async () => {
  mockPlatform = 'ios';
  await walletFileService.exportWallet('synthetic-test-material', options);
  expect(Sharing.shareAsync).toHaveBeenCalled();
});
