import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { InputStage } from '~/features/payments/receive/InputStage';
import { ScanAndPayStage } from '~/features/payments/send/ScanAndPayStage';
jest.mock('~/features/nfc/nfcFlow', () => ({ nfcFlow: { openReader: jest.fn() } }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) => selector({ scannerResult: null, setScannerResult: jest.fn() }),
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  View: 'View',
  TextArea: 'TextArea',
  ScrollView: 'ScrollView',
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Scan: 'Scan',
  Nfc: 'Nfc',
  AlertCircle: 'AlertCircle',
  ClipboardPaste: 'ClipboardPaste',
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 1, Light: 2 },
}));

it.each(['receive', 'send'])(
  'keeps %s input editable and announces a safe inline clipboard failure',
  async (mode) => {
    (Clipboard.getStringAsync as jest.Mock).mockRejectedValue(
      new Error('native error with private data'),
    );
    const setValue = jest.fn();
    const continueFlow = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        mode === 'receive' ? (
          <InputStage token="" setToken={setValue} onContinue={continueFlow} />
        ) : (
          <ScanAndPayStage input="" setInput={setValue} onContinue={continueFlow} />
        ),
      );
    });
    const paste = tree.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Paste')!;
    await act(async () => paste.props.onPress());
    const error = tree.root
      .findAllByType('Text' as any)
      .find(
        (node) =>
          node.props.children === 'Could not read the clipboard. Paste or type the details.',
      );
    expect(error?.props).toMatchObject({
      accessibilityRole: 'alert',
      accessibilityLiveRegion: 'polite',
    });
    expect(setValue).not.toHaveBeenCalled();
    expect(continueFlow).not.toHaveBeenCalled();
    expect(
      tree.root
        .findAllByType('Text' as any)
        .some(
          (node) =>
            typeof node.props.children === 'string' && node.props.children.includes('private data'),
        ),
    ).toBe(false);
    await act(async () => tree.unmount());
  },
);
