import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ScannerScreen from '~/features/payments/ScannerScreen';

const mockResolve = jest.fn();
const mockFeedback = jest.fn();
const mockRedirect = jest.fn((_result: unknown, _options: unknown) => true);
const mockToast = { show: jest.fn() };
jest.mock('~/shared/utils/universalInputResolver', () => ({
  resolveUniversalInput: (...args: unknown[]) => mockResolve(...args),
}));
jest.mock('~/shared/utils/universalRedirect', () => ({
  handleUniversalRedirect: (result: unknown, options: unknown) => mockRedirect(result, options),
}));
jest.mock('~/shared/ui/OperationFeedback', () => ({
  usePendingOperationToast: (props: unknown) => mockFeedback(props),
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockToast }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ returnTo: '/receive' }),
}));
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));
jest.mock('@gandlaf21/bc-ur', () => ({ URDecoder: jest.fn() }));
jest.mock('nostr-tools', () => ({ nip19: {} }));
jest.mock('~/state/authStore', () => ({ useAuthStore: () => ({ setLockDisabled: jest.fn() }) }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ setScannerResult: jest.fn() }) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  View: 'View',
  ZStack: 'ZStack',
  Spinner: 'Spinner',
  Theme: 'Theme',
}));
jest.mock('@tamagui/lucide-icons', () => ({
  X: 'X',
  Zap: 'Zap',
  ZapOff: 'ZapOff',
  RefreshCcw: 'RefreshCcw',
  Clipboard: 'Clipboard',
}));

it.each(['creqA-scanned-request', 'https://bey.cash/r/#shared-request'])(
  'shows automatic progress while resolving %s, then clears it after redirect',
  async (input) => {
    let resolve!: (result: unknown) => void;
    mockResolve.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<ScannerScreen />);
    });
    await act(async () =>
      tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: input }),
    );
    expect(mockResolve).toHaveBeenLastCalledWith(input);
    expect(mockFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: true, title: 'Reading QR code…' }),
    );
    await act(async () => resolve({ type: 'cashu_request' }));
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
    await act(async () => tree.unmount());
  },
);

it('clears progress and allows another scan when decoding fails', async () => {
  mockResolve.mockRejectedValue(new Error('Request unavailable'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () =>
    tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: 'invalid' }),
  );
  expect(mockToast.show).toHaveBeenCalledWith(
    'Unable to read QR code: Request unavailable',
    expect.objectContaining({ kind: 'error' }),
  );
  expect(mockFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
  expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeDefined();
  await act(async () => tree.unmount());
});
