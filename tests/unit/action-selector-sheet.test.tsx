import React from 'react';
import { Modal, Platform, ScrollView } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActionSelectorSheet, {
  type ActionSelectorSheetRef,
  type ActionSheetType,
} from '~/shared/ui/ActionSelectorSheet';

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockPresent = jest.fn();
const originalPlatform = Platform.OS;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
const mockOpenReader = jest.fn();
jest.mock('~/features/nfc/nfcFlow', () => ({ nfcFlow: { openReader: () => mockOpenReader() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('tamagui', () => ({ YStack: 'YStack', XStack: 'XStack', Text: 'Text', View: 'View' }));
jest.mock('@tamagui/lucide-icons', () => ({
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
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'ScrollView' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'ListTable' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Option' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return React.createElement('Sheet', props, props.children);
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
const options = () => tree.root.findAllByType('Option' as any);
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
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  Platform.OS = originalPlatform;
});

it.each(['send', 'receive'] as const)('opens %s as a full-screen Android modal', async (type) => {
  Platform.OS = 'android';
  await open(type);
  expect(tree.root.findByType(Modal).props).toMatchObject({
    visible: true,
    presentationStyle: 'fullScreen',
    animationType: 'slide',
  });
  expect(mockPresent).not.toHaveBeenCalled();
  expect(tree.root.findByType('Sheet' as any).props.children).toBeNull();
  expect(input().props.scrollComponent).toBe(ScrollView);
  expect(labels()).toEqual(
    type === 'send' ? ['Scan', 'Share ecash', 'Tap to pay'] : ['Scan', 'Request ecash', 'Bitcoin'],
  );
  await press('Close');
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => ref.current!.present(type));
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose!());
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});

it('preserves Receive Bitcoin navigation inside the Android modal', async () => {
  Platform.OS = 'android';
  await open('receive');
  await press('Bitcoin');
  expect(labels()).toEqual(['Lightning', 'On-chain']);
  await press('Back');
  expect(labels()).toEqual(['Scan', 'Request ecash', 'Bitcoin']);
  await press('Bitcoin');
  await press('On-chain');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/mint?mode=onchain');
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
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
  expect(labels()).toEqual(['Scan', 'Share ecash', 'Tap to pay']);
  await press('Share ecash');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/send?mode=standard');
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

it.each([
  ['receive', 'Lightning', '/(modals)/mint'],
  ['receive', 'On-chain', '/(modals)/mint?mode=onchain'],
] as const)('routes %s Bitcoin via %s to the correct flow', async (type, method, path) => {
  await open(type);
  expect(labels()).toEqual(['Scan', 'Request ecash', 'Bitcoin']);
  await press('Bitcoin');
  expect(labels()).toEqual(['Lightning', 'On-chain']);
  expect(mockPush).not.toHaveBeenCalled();
  await press(method);
  expect(mockPush).toHaveBeenCalledWith(path);
});

it('opens an ecash request directly without a second selector', async () => {
  await open('receive');
  await press('Request ecash');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/receive?mode=request');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('keeps the input draft across choices and Back, then resets on reopening', async () => {
  await open('receive');
  await act(async () => input().props.setValue('payment draft'));
  await press('Bitcoin');
  expect(input().props.value).toBe('payment draft');
  await press('Back');
  expect(labels()).toEqual(['Scan', 'Request ecash', 'Bitcoin']);
  expect(input().props.value).toBe('payment draft');
  await act(async () => ref.current!.present('send'));
  expect(labels()).toEqual(['Scan', 'Share ecash', 'Tap to pay']);
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
  expect(tree.root.findByType('Sheet' as any).props.snapPoints).toEqual(['75%', '90%']);
  await press(label);
  expect(mockPush).toHaveBeenCalledWith(path);
});

it.each(['send', 'receive'] as const)(
  'uses separate action cards with History icon styling for %s',
  async (type) => {
    await open(type);
    expect(tree.root.findByType('Sheet' as any).props.snapPoints).toEqual(['60%', '90%']);
    expect(input().props).toMatchObject({ layout: 'screen', compact: true });
    const group = options()[0].parent!;
    expect(group.props.gap).toBe(12);
    expect(group.props.separator).toBeUndefined();
    expect(group.children).toEqual(options());
    for (const option of options()) {
      expect(option.props).toMatchObject({
        minHeight: 48,
        flexDirection: 'row',
        bg: '$buttonDefaultSecondary',
        items: 'center',
        rounded: '$6',
        overflow: 'hidden',
      });
      expect(option.findAllByProps({ size: 22 })).toHaveLength(1);
      const icon = option.findByProps({ size: 22 });
      expect(icon.props).toMatchObject({ color: '$gray10', strokeWidth: 2.5 });
      expect(icon.parent!.props).toMatchObject({
        width: 44,
        height: 44,
        rounded: 100,
        bg: '$gray3',
      });
      expect(option.findAllByType('ChevronRight' as any)).toHaveLength(0);
      const [label, description] = option.findAllByType('Text' as any);
      expect(label.props).toMatchObject({ fontSize: 16, fontWeight: '500' });
      expect(description.props).toMatchObject({ fontSize: 14, color: '$gray10' });
      expect(description.props.children).toBe(option.props.accessibilityHint);
      expect(label.props.numberOfLines).toBeUndefined();
    }
  },
);

it.each([
  ['send', '/(modals)/scanner'],
  ['receive', { pathname: '/(modals)/scanner', params: { returnTo: '/receive' } }],
] as const)('opens the existing %s scanner after dismissing the sheet', async (type, path) => {
  await open(type);
  await press('Scan');
  expect(mockPush).toHaveBeenCalledWith(path);
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

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
    expect(option.findAllByProps({ size: 28 })).toHaveLength(1);
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
