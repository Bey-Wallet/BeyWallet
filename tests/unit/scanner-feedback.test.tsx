import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ScannerScreen from '~/features/payments/ScannerScreen';
import { useP2PKScanStore } from '~/state/p2pkScanStore';
import { URDecoder } from '@gandlaf21/bc-ur';

const mockResolve = jest.fn();
const mockFeedback = jest.fn();
const mockRedirect = jest.fn((_result: unknown, _options: unknown) => true);
const mockToast = { show: jest.fn() };
let mockParams: Record<string, string | undefined> = { returnTo: '/receive' };
const mockBack = jest.fn();
const mockSetScannerResult = jest.fn();
const mockPickImage = jest.fn();
let mockCameraGranted = true;
jest.mock('~/services/platform/qrImageService', () => ({
  pickQrImage: () => mockPickImage(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockCameraGranted = true;
  mockPickImage.mockResolvedValue(null);
  mockParams = { returnTo: '/receive' };
  useP2PKScanStore.getState().setResult(null);
});
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
  useRouter: () => ({ back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: mockCameraGranted }, jest.fn()],
}));
jest.mock('@gandlaf21/bc-ur', () => ({ URDecoder: jest.fn() }));
jest.mock('nostr-tools', () => ({ nip19: {} }));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isLockDisabled: false, setLockDisabled: jest.fn() }) },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ setScannerResult: mockSetScannerResult }) },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
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
  Image: 'Image',
  Zap: 'Zap',
  ZapOff: 'ZapOff',
  RefreshCcw: 'RefreshCcw',
  Clipboard: 'Clipboard',
  ScanLine: 'ScanLine',
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
    await act(async () => {
      void tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: input });
    });
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
    'QR code not recognized',
    expect.objectContaining({ kind: 'error' }),
  );
  expect(mockFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
  expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeDefined();
  await act(async () => tree.unmount());
});

it.each([
  ['send', {}, 'lightning_invoice'],
  ['send', {}, 'lightning_address'],
  ['send', {}, 'bitcoin_onchain'],
  ['send', {}, 'cashu_request'],
  ['receive', { returnTo: '/receive' }, 'cashu_token'],
] as const)('resolves %s scans of %s through payment routing', async (_flow, params, type) => {
  mockParams = params;
  const result = { type, raw: 'payment-value', cleaned: 'payment-value' };
  mockResolve.mockResolvedValueOnce(result);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () =>
    tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: 'payment-value' }),
  );
  expect(mockResolve).toHaveBeenCalledWith('payment-value');
  expect(mockRedirect).toHaveBeenCalledWith(result, expect.objectContaining({ replace: true }));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockSetScannerResult).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('returns a public-key scan only to its key sheet without invoking payment routing', async () => {
  mockParams = { p2pkScanId: 'key-editor-1' };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () =>
    tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: '  02-public-key  ' }),
  );
  expect(useP2PKScanStore.getState().result).toEqual({
    id: 'key-editor-1',
    value: '02-public-key',
  });
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockSetScannerResult).not.toHaveBeenCalled();
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('toggles the camera torch from the header without a paste action', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  expect(tree.root.findByType('CameraView' as any).props.enableTorch).toBe(false);
  const buttons = tree.root.findAllByType('AppIconButton' as any);
  const flashButton = buttons.find(
    (node) => node.props.accessibilityLabel === 'Turn flashlight on',
  )!;
  await act(async () => flashButton.props.onPress());
  expect(tree.root.findByType('CameraView' as any).props.enableTorch).toBe(true);
  const offButton = tree.root
    .findAllByType('AppIconButton' as any)
    .find((node) => node.props.accessibilityLabel === 'Turn flashlight off')!;
  expect(offButton.props.accessibilityState).toEqual({ selected: true });
  await act(async () => offButton.props.onPress());
  expect(tree.root.findByType('CameraView' as any).props.enableTorch).toBe(false);
  expect(
    tree.root.findAllByType('AppButton' as any).map((button) => button.props.children),
  ).toEqual(['Choose image']);
  await act(async () => tree.unmount());
});

it('shows animated QR progress without resolving an incomplete payload', async () => {
  const decoder = {
    receivedPartIndexes: [] as number[],
    receivePart: jest.fn(() => decoder.receivedPartIndexes.push(1)),
    estimatedPercentComplete: () => 0.42,
    isComplete: () => false,
  };
  jest.mocked(URDecoder).mockImplementation(() => decoder as unknown as URDecoder);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () =>
    tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data: 'ur:bytes/1-5/part' }),
  );
  expect(decoder.receivePart).toHaveBeenCalledWith('ur:bytes/1-5/part');
  const progress = tree.root.findByProps({ accessibilityLabel: 'Reading animated QR' });
  expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  expect(tree.root.findByType('Spinner' as any)).toBeDefined();
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children.includes?.(42)),
  ).toBe(true);
  expect(mockResolve).not.toHaveBeenCalled();
  expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeDefined();
  await act(async () => tree.unmount());
});

it.each([
  'cashu_token',
  'lightning_invoice',
  'cashu_request',
  'lightning_address',
  'bitcoin_onchain',
  'bey_share_token',
  'bey_share_request',
])('routes imported %s through the same resolver and redirect as the camera', async (type) => {
  mockParams = {};
  const result = { type, raw: 'complete-qr-value' };
  mockPickImage.mockResolvedValue('complete-qr-value');
  mockResolve.mockResolvedValue(result);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(mockResolve).toHaveBeenCalledWith('complete-qr-value');
  expect(mockRedirect).toHaveBeenCalledWith(result, expect.objectContaining({ replace: true }));
  await act(async () => tree.unmount());
});

it('imports an image without camera access and leaves cancellation on the scanner', async () => {
  mockCameraGranted = false;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  expect(tree.root.findAllByType('CameraView' as any)).toHaveLength(0);
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((b) => b.props.children === 'Choose image')!
      .props.onPress(),
  );
  expect(mockPickImage).toHaveBeenCalledTimes(1);
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockBack).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('pauses camera scans and repeated import taps while the picker is open', async () => {
  let finish!: (data: null) => void;
  mockPickImage.mockImplementation(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  const cameraScan = tree.root.findByType('CameraView' as any).props.onBarcodeScanned;
  const choose = tree.root.findByType('AppButton' as any).props.onPress;
  await act(async () => {
    void choose();
    void choose();
    cameraScan({ data: 'camera-value' });
  });
  expect(mockPickImage).toHaveBeenCalledTimes(1);
  expect(mockResolve).not.toHaveBeenCalled();
  expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeUndefined();
  await act(async () => finish(null));
  expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeDefined();
  await act(async () => tree.unmount());
});

it('shows an image error and keeps the scanner ready for another image', async () => {
  mockPickImage.mockRejectedValue(new Error('No QR code found.'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((node) => node.props.children === 'No QR code found.'),
  ).toBe(true);
  expect(tree.root.findByType('AppButton' as any).props.loading).toBe(false);
  expect(mockResolve).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it.each([{ returnTo: '/add-mint' }, { p2pkScanId: 'image-key-editor' }])(
  'keeps contextual image scans scoped to their caller %j',
  async (params) => {
    mockParams = params;
    mockPickImage.mockResolvedValue('context-value');
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<ScannerScreen />);
    });
    await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
    if (params.p2pkScanId) {
      expect(useP2PKScanStore.getState().result).toEqual({
        id: params.p2pkScanId,
        value: 'context-value',
      });
      expect(mockSetScannerResult).not.toHaveBeenCalled();
    } else expect(mockSetScannerResult).toHaveBeenCalledWith('context-value');
    await act(async () => tree.unmount());
  },
);

it('never routes an isolated animated QR frame imported as an image', async () => {
  jest.mocked(URDecoder).mockImplementation(
    () =>
      ({
        receivedPartIndexes: [],
        receivePart: jest.fn(),
        estimatedPercentComplete: () => 0.2,
        isComplete: () => false,
      }) as unknown as URDecoder,
  );
  mockPickImage.mockResolvedValue('ur:bytes/1-5/part');
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(mockResolve).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((node) => String(node.props.children).includes('animated code with the camera')),
  ).toBe(true);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('decodes a complete single-part UR image before routing its full payload', async () => {
  jest.mocked(URDecoder).mockImplementation(
    () =>
      ({
        receivedPartIndexes: [],
        receivePart: jest.fn(),
        estimatedPercentComplete: () => 1,
        isComplete: () => true,
        isSuccess: () => true,
        resultUR: () => ({ decodeCBOR: () => Buffer.from('cashuB-full-payload') }),
      }) as unknown as URDecoder,
  );
  mockPickImage.mockResolvedValue('ur:bytes/complete');
  mockResolve.mockResolvedValue({ type: 'cashu_token' });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ScannerScreen />);
  });
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(mockResolve).toHaveBeenCalledWith('cashuB-full-payload');
  expect(mockRedirect).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
