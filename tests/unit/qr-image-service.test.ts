import { pickQrImage } from '~/services/platform/qrImageService';
import * as DocumentPicker from 'expo-document-picker';
import { scanFromURLAsync } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

const mockLock = jest.fn();
let mockPreviouslyDisabled = false;
jest.mock('~/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({ isLockDisabled: mockPreviouslyDisabled, setLockDisabled: mockLock }),
  },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-camera', () => ({ scanFromURLAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
}));
beforeEach(() => {
  jest.resetAllMocks();
  mockPreviouslyDisabled = false;
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///cache/image.png', name: 'image.png', mimeType: 'image/png', lastModified: 0 },
    ],
  });
  jest.mocked(scanFromURLAsync).mockResolvedValue([{ data: 'cashuB-test', type: 'qr' }] as any);
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
});

it('reads the full QR locally and removes only the cached picker copy', async () => {
  await expect(pickQrImage()).resolves.toBe('cashuB-test');
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  expect(scanFromURLAsync).toHaveBeenCalledWith('file:///cache/image.png', ['qr']);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/image.png', {
    idempotent: true,
  });
  expect(mockLock.mock.calls).toEqual([[true], [false]]);
});
it('treats cancellation as no input and restores an already disabled lock', async () => {
  mockPreviouslyDisabled = true;
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });
  await expect(pickQrImage()).resolves.toBeNull();
  expect(scanFromURLAsync).not.toHaveBeenCalled();
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  expect(mockLock.mock.calls).toEqual([[true], [true]]);
});
it.each([
  [[], 'No QR code found'],
  [[{ data: 'one' }, { data: 'two' }], 'More than one QR code found'],
])('rejects missing or ambiguous QR content', async (codes, message) => {
  jest.mocked(scanFromURLAsync).mockResolvedValue(codes as any);
  await expect(pickQrImage()).rejects.toThrow(message);
  expect(mockLock).toHaveBeenLastCalledWith(false);
  expect(FileSystem.deleteAsync).toHaveBeenCalled();
});
it('accepts repeated detections of the same payload without modifying its contents', async () => {
  jest
    .mocked(scanFromURLAsync)
    .mockResolvedValue([{ data: '  lightning:LNtest  ' }, { data: 'lightning:LNtest' }] as any);
  await expect(pickQrImage()).resolves.toBe('lightning:LNtest');
});
it('does not delete an original image outside the app cache', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photos/original.png', name: 'original.png', lastModified: 0 }],
  });
  await pickQrImage();
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});
it('hides native decoding errors and still cleans the cache and restores the lock', async () => {
  jest.mocked(scanFromURLAsync).mockRejectedValue(new Error('private native details'));
  await expect(pickQrImage()).rejects.toThrow('Could not read this image.');
  expect(mockLock).toHaveBeenLastCalledWith(false);
  expect(FileSystem.deleteAsync).toHaveBeenCalled();
});
it('hides native picker errors and restores the lock', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockRejectedValue(new Error('private path'));
  await expect(pickQrImage()).rejects.toThrow('Could not open this image.');
  expect(mockLock).toHaveBeenLastCalledWith(false);
});
it('does not lose the decoded QR when cache cleanup fails', async () => {
  jest.mocked(FileSystem.deleteAsync).mockRejectedValue(new Error('cleanup failed'));
  await expect(pickQrImage()).resolves.toBe('cashuB-test');
});
