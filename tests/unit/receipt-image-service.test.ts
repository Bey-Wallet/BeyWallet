import { shareReceiptImage } from '~/services/platform/receiptImageService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
const mockLock = jest.fn();
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isLockDisabled: false, setLockDisabled: mockLock }) },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
});
it('exports only the isolated SVG as a high-resolution PNG and opens native sharing', async () => {
  const render = jest.fn((callback: (data: string) => void, _options?: object) =>
    callback('public-png-data'),
  );
  await shareReceiptImage({ toDataURL: render });
  expect(render.mock.calls[0][1]).toEqual({ width: 1280, height: 1360 });
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    expect.stringMatching(/^cache\/bey-receipt-\d+\.png$/),
    'public-png-data',
    { encoding: 'base64' },
  );
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ mimeType: 'image/png' }),
  );
  expect(mockLock.mock.calls).toEqual([[true], [false]]);
});
it('does not render or write when sharing is unavailable', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  const render = jest.fn();
  await expect(shareReceiptImage({ toDataURL: render })).rejects.toThrow('unavailable');
  expect(render).not.toHaveBeenCalled();
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});
it('restores the native-session lock after failed sharing', async () => {
  jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('Cancelled'));
  await expect(
    shareReceiptImage({ toDataURL: (callback) => callback('public-data') }),
  ).rejects.toThrow();
  expect(mockLock).toHaveBeenLastCalledWith(false);
});
