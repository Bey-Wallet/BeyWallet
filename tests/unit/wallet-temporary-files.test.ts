import * as FileSystem from 'expo-file-system/legacy';
import { clearWalletTemporaryFiles } from '~/services/platform/walletTemporaryFiles';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///private/cache/',
  documentDirectory: 'file:///private/documents/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => {}),
}));
beforeEach(() => jest.clearAllMocks());

it('removes app-owned backup/proof/receipt copies and picker files without touching saved external backups or app assets', async () => {
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockResolvedValueOnce([
      'DocumentPicker',
      'bey_wallet_backup_test.json',
      'bey_cashu_proofs_test.json',
      'bey-receipt-1.png',
      'ExponentAsset-font.ttf',
    ])
    .mockResolvedValueOnce(['bey_wallet_backup_fallback.json', 'SQLite', 'updates', 'other.txt']);
  await clearWalletTemporaryFiles();
  expect(jest.mocked(FileSystem.deleteAsync).mock.calls.map(([path]) => path)).toEqual([
    'file:///private/cache/DocumentPicker',
    'file:///private/cache/bey_wallet_backup_test.json',
    'file:///private/cache/bey_cashu_proofs_test.json',
    'file:///private/cache/bey-receipt-1.png',
    'file:///private/documents/bey_wallet_backup_fallback.json',
  ]);
});

it('waits for every removal before reporting a failure', async () => {
  let finish!: () => void;
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockResolvedValueOnce(['bey_wallet_backup_1.json', 'bey_wallet_backup_2.json']);
  jest
    .mocked(FileSystem.deleteAsync)
    .mockRejectedValueOnce(new Error('Busy file'))
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
  const result = clearWalletTemporaryFiles();
  const settled = jest.fn();
  void result.then(settled, settled);
  for (let i = 0; i < 6; i++) await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  finish();
  await expect(result).rejects.toThrow('Temporary wallet files');
});

it('rejects paths outside the private directory and skips absent directories', async () => {
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockResolvedValueOnce(['bey_wallet_backup_/../../external.json']);
  await expect(clearWalletTemporaryFiles()).rejects.toThrow('Invalid temporary file path');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockResolvedValueOnce({ exists: false, uri: '', isDirectory: false })
    .mockResolvedValueOnce({ exists: false, uri: '', isDirectory: false });
  await clearWalletTemporaryFiles();
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});
