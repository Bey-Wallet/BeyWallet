import React from 'react';
import { AppState, Modal, Platform } from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { appActionIconColors } from '~/shared/theme/appearance';
import ActionSelectorSheet, {
  type ActionSelectorSheetRef,
  type ActionSheetType,
} from '~/shared/ui/ActionSelectorSheet';

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockPresent = jest.fn();
const originalPlatform = Platform.OS;
const mockPreview = jest.fn();
const mockDisposePayment = jest.fn(async () => {});
const mockSaveReview = jest.fn((..._args: unknown[]) => 'prepared-review');
const mockWallet = { activeMintUrl: 'mint-a' };
const mockIdentity = { npub: 'wallet-id' };
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: async () => false },
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: { getState: () => mockWallet } }));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: () => mockIdentity } }));
jest.mock('~/services/wallet/lightningPayment', () => ({
  LightningPayment: jest.fn().mockImplementation((mintUrl, invoice) => ({
    mintUrl,
    invoice,
    preview: mockPreview,
    dispose: mockDisposePayment,
  })),
}));
jest.mock('~/services/wallet/lightningReviewSession', () => ({
  saveLightningReview: (...args: unknown[]) => mockSaveReview(...args),
  discardLightningReview: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
const mockOpenReader = jest.fn();
jest.mock('~/features/nfc/nfcFlow', () => ({ nfcFlow: { openReader: () => mockOpenReader() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('tamagui', () => ({
  useThemeName: () => 'dark',
  useTheme: () => ({}),
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  View: 'View',
}));
jest.mock('~/shared/icons', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
  Banknote: 'Banknote',
  Bitcoin: 'Bitcoin',
  Zap: 'Zap',
  Clipboard: 'Clipboard',
  HandCoins: 'HandCoins',
  Scan: 'Scan',
  Nfc: 'Nfc',
  ArrowLeft: 'ArrowLeft',
  AtSign: 'AtSign',
  Store: 'Store',
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: 'ScrollView',
  BottomSheetTextInput: 'SheetInput',
}));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'ListTable' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Option' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        present: mockPresent,
        dismiss: () => {
          if (props.canDismiss !== false) mockDismiss();
        },
      }));
      return require('react').createElement(
        'Sheet',
        props,
        require('react').createElement(require('~/shared/ui/BUI/BUIHeader').BUIHeader, {
          title: props.title,
          navigation: props.navigation ?? 'close',
          navigationLabel: props.navigationLabel,
          navigationDisabled: props.canDismiss === false,
          onNavigate: props.onNavigate,
        }),
        props.children,
      );
    }),
  };
});
jest.mock('~/shared/ui/UniversalInputCard', () => {
  const React = require('react');
  return {
    UniversalInputCard: React.forwardRef((props: any, ref: any) => {
      const [value, setValue] = React.useState('');
      React.useImperativeHandle(ref, () => ({ clear: () => setValue('') }));
      return React.createElement('InputCard', { ...props, value, setValue });
    }),
  };
});

let tree: ReactTestRenderer;
let ref: React.RefObject<ActionSelectorSheetRef | null>;
const options = () =>
  tree.root
    .findAllByType('Option' as any)
    .filter((node) => !['Back', 'Close'].includes(node.props.accessibilityLabel));
const labels = () => options().map((option) => option.props.accessibilityLabel);
const input = () => tree.root.findByType('InputCard' as any);
async function open(type: ActionSheetType) {
  ref = React.createRef<ActionSelectorSheetRef>();
  await act(async () => {
    tree = create(<ActionSelectorSheet ref={ref} />);
  });
  await act(async () => ref.current!.present(type));
}
async function press(label: string) {
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
}

it('prepares an invoice inside the sheet and opens the same payment directly for review', async () => {
  await open('send');
  let finish!: (quote: unknown) => void;
  mockPreview.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  let preparation!: Promise<boolean>;
  await act(async () => {
    preparation = input().props.onHandleResolved({
      type: 'lightning_invoice',
      cleaned: 'lnbc1invoice',
    });
  });
  expect(tree.root.findByType('Sheet' as any).props.title).toBe('Preparing payment');
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
  expect(mockPush).not.toHaveBeenCalled();
  const quote = { quote: 'quote-id', amount: 20, fee_reserve: 2, expiry: Date.now() / 1000 + 60 };
  await act(async () => {
    finish(quote);
    await preparation;
  });
  expect(mockPreview).toHaveBeenCalledTimes(1);
  expect(mockDisposePayment).not.toHaveBeenCalled();
  expect(mockSaveReview).toHaveBeenCalledWith(
    'wallet-id',
    expect.objectContaining({ mintUrl: 'mint-a', invoice: 'lnbc1invoice' }),
    quote,
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/melt',
    params: { reviewId: 'prepared-review' },
  });
});

it('keeps failed preparation in the sheet and releases the unsubmitted payment', async () => {
  await open('send');
  mockPreview.mockRejectedValue(new Error('mint unavailable'));
  await act(async () => {
    await input().props.onHandleResolved({ type: 'lightning_invoice', cleaned: 'lnbc1invoice' });
  });
  expect(mockDisposePayment).toHaveBeenCalled();
  expect(mockSaveReview).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(true);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'Could not prepare',
  );
});

it('does not navigate with a quote completed after closing the sheet', async () => {
  await open('send');
  let finish!: (quote: unknown) => void;
  mockPreview.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  let preparation!: Promise<boolean>;
  await act(async () => {
    preparation = input().props.onHandleResolved({
      type: 'lightning_invoice',
      cleaned: 'lnbc1invoice',
    });
  });
  await act(async () => ref.current!.dismiss());
  await act(async () => {
    finish({ quote: 'quote-id', amount: 20, fee_reserve: 2 });
    await preparation;
  });
  expect(mockDisposePayment).toHaveBeenCalled();
  expect(mockSaveReview).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('releases preparation on background and ignores its late quote', async () => {
  let listener!: (state: string) => void;
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback: any) => {
      listener = callback;
      return { remove: jest.fn() };
    });
  await open('send');
  subscription.mockRestore();
  let finish!: (quote: unknown) => void;
  mockPreview.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  let preparation!: Promise<boolean>;
  await act(async () => {
    preparation = input().props.onHandleResolved({
      type: 'lightning_invoice',
      cleaned: 'lnbc1invoice',
    });
  });
  await act(async () => listener('background'));
  await act(async () => {
    finish({ quote: 'quote-id', amount: 20, fee_reserve: 2 });
    await preparation;
  });
  expect(mockDisposePayment).toHaveBeenCalled();
  expect(mockSaveReview).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('paused');
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  mockIdentity.npub = 'wallet-id';
  mockPreview.mockReset();
  Platform.OS = 'ios';
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  Platform.OS = originalPlatform;
});

it.each(['send', 'receive'] as const)('opens %s as an Android bottom sheet', async (type) => {
  Platform.OS = 'android';
  await open(type);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(true);
  expect(tree.root.findByType('Sheet' as any).props.backgroundColor).toBe('$background');
  expect(input().props.contentSized).toBe(true);
  expect(labels()).toEqual(
    type === 'send'
      ? ['Share ecash', 'Tap to pay']
      : ['Request ecash', 'Bitcoin', 'Point of sale', 'My addresses'],
  );
  await press('Close');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  await act(async () => ref.current!.present(type));
  expect(mockPresent).toHaveBeenCalledTimes(2);
  await act(async () => input().props.onProcessingChange(true));
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
});

it.each(['send', 'receive'] as const)(
  'dismisses %s when a paste lookup resolves using its original callbacks',
  async (type) => {
    await open(type);
    const { onBeforeRedirect, onProcessingChange } = input().props;
    await act(async () => input().props.onProcessingChange(true));
    expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
    await act(async () => {
      onProcessingChange(false);
      onBeforeRedirect();
    });
    expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(true);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  },
);

it('preserves Receive Bitcoin navigation inside the Android bottom sheet', async () => {
  Platform.OS = 'android';
  await open('receive');
  await press('Bitcoin');
  expect(labels()).toEqual(['Create invoice', 'Lightning address', 'On-chain']);
  await press('Back');
  expect(labels()).toEqual(['Request ecash', 'Bitcoin', 'Point of sale', 'My addresses']);
  await press('Bitcoin');
  await press('On-chain');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/mint?mode=onchain');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('keeps Mint as an Android bottom sheet', async () => {
  Platform.OS = 'android';
  await open('mint');
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(options()).toHaveLength(4);
});

it('shares ecash directly from the Send action list', async () => {
  await open('send');
  expect(labels()).toEqual(['Share ecash', 'Tap to pay']);
  await press('Share ecash');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/send?mode=standard');
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

it.each([
  ['receive', 'Create invoice', '/(modals)/mint'],
  ['receive', 'Lightning address', '/(modals)/nostr-profile?tab=lightning'],
  ['receive', 'On-chain', '/(modals)/mint?mode=onchain'],
] as const)('routes %s Bitcoin via %s to the correct flow', async (type, method, path) => {
  await open(type);
  expect(labels()).toEqual(['Request ecash', 'Bitcoin', 'Point of sale', 'My addresses']);
  await press('Bitcoin');
  expect(labels()).toEqual(['Create invoice', 'Lightning address', 'On-chain']);
  expect(mockPush).not.toHaveBeenCalled();
  await press(method);
  expect(mockPush).toHaveBeenCalledWith(path);
});

it('opens My addresses directly from Receive after dismissing the action sheet', async () => {
  await open('receive');
  await press('My addresses');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/nostr-profile');
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

it('opens an ecash request directly without a second selector', async () => {
  await open('receive');
  await press('Request ecash');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/receive?mode=request');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('opens Point of sale from Receive after dismissing the sheet', async () => {
  await open('receive');
  await press('Point of sale');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/point-of-sale');
});

it('keeps the input draft across choices and Back, then resets on reopening', async () => {
  await open('receive');
  await act(async () => input().props.setValue('payment draft'));
  await press('Bitcoin');
  expect(input().props.value).toBe('payment draft');
  await press('Back');
  expect(labels()).toEqual(['Request ecash', 'Bitcoin', 'Point of sale', 'My addresses']);
  expect(input().props.value).toBe('payment draft');
  await act(async () => ref.current!.present('send'));
  expect(labels()).toEqual(['Share ecash', 'Tap to pay']);
  expect(input().props.value).toBe('');
});

it('keeps automatic input routing available in the second step', async () => {
  await open('receive');
  await press('Bitcoin');
  expect(input().props.label).toBe('Payment details');
  await act(async () => input().props.onBeforeRedirect());
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it.each([
  ['Top up via Lightning', '/(modals)/mint'],
  ['Top up on-chain', '/(modals)/mint?mode=onchain'],
  ['Pay with Lightning', '/(modals)/melt'],
  ['Pay on-chain', '/(modals)/melt?mode=onchain'],
] as const)('keeps Fund & withdraw routing for %s', async (label, path) => {
  await open('mint');
  expect(options()).toHaveLength(4);
  expect(tree.root.findByType('Sheet' as any).props.snapPoints).toBeUndefined();
  await press(label);
  expect(mockPush).toHaveBeenCalledWith(path);
});

it.each(['send', 'receive'] as const)(
  'uses separate action cards with semantic icon styling for %s',
  async (type) => {
    await open(type);
    expect(tree.root.findByType('Sheet' as any).props.snapPoints).toBeUndefined();
    expect(input().props).toMatchObject({
      layout: 'screen',
      compact: true,
      inputComponent: BottomSheetTextInput,
      contentSized: true,
    });
    const group = options()[0].parent!;
    expect(group.props.gap).toBe(12);
    expect(group.props.separator).toBeUndefined();
    expect(group.children).toEqual(options());
    for (const option of options()) {
      expect(option.props).toMatchObject({
        minHeight: 48,
        flexDirection: 'row',
        bg: '$gray2',
        items: 'center',
        rounded: '$6',
        overflow: 'hidden',
      });
      expect(option.findAllByProps({ size: 22 })).toHaveLength(1);
      const icon = option.findByProps({ size: 22 });
      expect(Object.values(appActionIconColors).map((colors) => colors.foreground)).toContain(
        icon.props.color,
      );
      expect(icon.parent!.props).toMatchObject({
        width: 44,
        height: 44,
        rounded: 100,
      });
      expect(Object.values(appActionIconColors).map((colors) => colors.background)).toContain(
        icon.parent!.props.bg,
      );
      expect(option.findAllByType('ChevronRight' as any)).toHaveLength(0);
      const [label, description] = option.findAllByType('Text' as any);
      expect(label.props).toMatchObject({ fontSize: 14, fontWeight: '500' });
      expect(description.props).toMatchObject({ fontSize: 13, color: '$gray10' });
      expect(description.props.children).toBe(option.props.accessibilityHint);
      expect(label.props.numberOfLines).toBeUndefined();
    }
  },
);

it('dismisses Send before opening the existing NFC reader and ignores repeated taps', async () => {
  await open('send');
  await act(async () => input().props.onProcessingChange(true));
  await press('Tap to pay');
  expect(mockOpenReader).not.toHaveBeenCalled();
  await act(async () => input().props.onProcessingChange(false));
  await press('Tap to pay');
  await press('Tap to pay');
  expect(mockOpenReader).toHaveBeenCalledTimes(1);
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockOpenReader.mock.invocationCallOrder[0],
  );
  expect(mockPush).not.toHaveBeenCalled();
});

it('preserves Mint cards and its stacked input', async () => {
  await open('mint');
  expect(input().props.layout).toBe('stacked');
  expect(options()).toHaveLength(4);
  for (const option of options()) {
    expect(option.props).toMatchObject({ minHeight: 112, flex: 1, rounded: '$6' });
    expect(option.findAllByProps({ size: 22 })).toHaveLength(1);
  }
});

it('blocks route choices while input resolves and ignores repeated route taps until reopening', async () => {
  await open('receive');
  await act(async () => input().props.onProcessingChange(true));
  expect(options().every((option) => option.props.disabled)).toBe(true);
  await press('Request ecash');
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => input().props.onProcessingChange(false));
  await act(async () => {
    const option = tree.root.findByProps({ accessibilityLabel: 'Request ecash' });
    option.props.onPress();
    option.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  await act(async () => ref.current!.present('send'));
  await press('Share ecash');
  expect(mockPush).toHaveBeenCalledTimes(2);
});

it('clears input when closed by a swipe or backdrop', async () => {
  await open('receive');
  await act(async () => input().props.setValue('draft'));
  await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
  expect(input().props.value).toBe('');
});
