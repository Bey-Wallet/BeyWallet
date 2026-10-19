import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActionSelectorSheet, {
  type ActionSelectorSheetRef,
  type ActionSheetType,
} from '~/shared/ui/ActionSelectorSheet';

const mockPush = jest.fn();
const mockDismiss = jest.fn();
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
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: mockDismiss }));
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
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('sends ecash directly to token creation with only two initial choices', async () => {
  await open('send');
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  await press('Ecash');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(modals)/send?mode=standard');
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

it.each([
  ['send', 'Lightning', '/(modals)/melt'],
  ['send', 'On-chain', '/(modals)/melt?mode=onchain'],
  ['receive', 'Lightning', '/(modals)/mint'],
  ['receive', 'On-chain', '/(modals)/mint?mode=onchain'],
] as const)('routes %s Bitcoin via %s to the correct flow', async (type, method, path) => {
  await open(type);
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  await press('Bitcoin');
  expect(labels()).toEqual(['Lightning', 'On-chain']);
  expect(mockPush).not.toHaveBeenCalled();
  await press(method);
  expect(mockPush).toHaveBeenCalledWith(path);
});

it('opens an ecash request directly without a second selector', async () => {
  await open('receive');
  await press('Ecash');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/receive?mode=request');
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('keeps the input draft across choices and Back, then resets on reopening', async () => {
  await open('receive');
  await act(async () => input().props.setValue('payment draft'));
  await press('Bitcoin');
  expect(input().props.value).toBe('payment draft');
  await press('Back');
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  expect(input().props.value).toBe('payment draft');
  await act(async () => ref.current!.present('send'));
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  expect(input().props.value).toBe('');
});

it('keeps automatic input routing available in the second step', async () => {
  await open('send');
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

it('uses large cards with an icon above a wrapping label and a stacked input', async () => {
  await open('send');
  expect(tree.root.findByType('Sheet' as any).props.snapPoints).toEqual(['60%', '90%']);
  expect(input().props.layout).toBe('stacked');
  for (const option of options()) {
    expect(option.props).toMatchObject({
      minHeight: 112,
      flex: 1,
      bg: '$buttonDefaultSecondary',
      items: 'flex-start',
    });
    expect(option.findAllByProps({ size: 28 })).toHaveLength(1);
    const label = option.findByType('Text' as any);
    expect(label.props).toMatchObject({ fontSize: 16, fontWeight: '500' });
    expect(label.props.numberOfLines).toBeUndefined();
  }
});

it('blocks route choices while input resolves and ignores repeated route taps until reopening', async () => {
  await open('receive');
  await act(async () => input().props.onProcessingChange(true));
  expect(options().every((option) => option.props.disabled)).toBe(true);
  await press('Ecash');
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => input().props.onProcessingChange(false));
  await act(async () => {
    const option = tree.root.findByProps({ accessibilityLabel: 'Ecash' });
    option.props.onPress();
    option.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  await act(async () => ref.current!.present('send'));
  await press('Ecash');
  expect(mockPush).toHaveBeenCalledTimes(2);
});

it('clears input when closed by a swipe or backdrop', async () => {
  await open('receive');
  await act(async () => input().props.setValue('draft'));
  await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
  expect(input().props.value).toBe('');
});
