import { walletFileService } from '~/services/platform/walletFileService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
const mockRecordFile = jest.fn();
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
jest.mock('~/state/backupStatusStore', () => ({
  useBackupStatusStore: { getState: () => ({ recordFile: mockRecordFile }) },
}));
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
  defaultMintUrl: '',
  secondaryCurrency: 'USD',
  theme: 'dark' as const,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform = 'android';
  jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined);
});
it('records a direct save only after the file write succeeds', async () => {
  await walletFileService.exportWallet('synthetic-test-material', options);
  expect(mockRecordFile).toHaveBeenCalledWith('saved');
});
it('leaves the last success untouched after a failed export', async () => {
  jest
    .mocked(FileSystem.writeAsStringAsync)
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(
    walletFileService.exportWallet('synthetic-test-material', options),
  ).rejects.toThrow();
  expect(mockRecordFile).not.toHaveBeenCalled();
});
it('records shared exports as unverified saves', async () => {
  mockPlatform = 'ios';
  await walletFileService.exportWallet('synthetic-test-material', options);
  expect(Sharing.shareAsync).toHaveBeenCalled();
  expect(mockRecordFile).toHaveBeenCalledWith('share-sheet');
});
