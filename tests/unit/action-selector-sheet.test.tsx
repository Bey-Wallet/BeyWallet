import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActionSelectorSheet, {
  type ActionSelectorSheetRef,
  type ActionSheetType,
} from '~/shared/ui/ActionSelectorSheet';

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockClipboard = jest.fn();
const mockToast = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: mockToast }) }));
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
  mockClipboard.mockResolvedValue('cashu-complete-token');
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

it('receives ecash through paste or request without extra method choices', async () => {
  await open('receive');
  await press('Ecash');
  expect(labels()).toEqual(['Paste ecash', 'Request ecash']);
  await press('Request ecash');
  expect(mockPush).toHaveBeenCalledWith('/(modals)/receive?mode=request');
});

it('keeps the input draft across choices and Back, then resets on reopening', async () => {
  await open('receive');
  await act(async () => input().props.setValue('payment draft'));
  await press('Bitcoin');
  expect(input().props.value).toBe('payment draft');
  await press('Back');
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  await press('Ecash');
  expect(input().props.value).toBe('payment draft');
  await act(async () => ref.current!.present('send'));
  expect(labels()).toEqual(['Ecash', 'Bitcoin']);
  expect(input().props.value).toBe('');
});

it('passes the complete trimmed clipboard value to receive', async () => {
  mockClipboard.mockResolvedValue('  cashu-complete-token  ');
  await open('receive');
  await press('Ecash');
  await press('Paste ecash');
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/receive',
    params: { mode: 'receive', scannedToken: 'cashu-complete-token' },
  });
});

it.each(['empty', 'denied'])('opens manual token input if the clipboard is %s', async (reason) => {
  if (reason === 'empty') mockClipboard.mockResolvedValue('  ');
  else mockClipboard.mockRejectedValue(new Error('Clipboard access denied'));
  await open('receive');
  await press('Ecash');
  await press('Paste ecash');
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/receive',
    params: { mode: 'receive' },
  });
  expect(mockToast).toHaveBeenCalled();
});

it('ignores duplicate paste taps and a clipboard result after closing the sheet', async () => {
  let resolve!: (value: string) => void;
  mockClipboard.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await open('receive');
  await press('Ecash');
  await press('Paste ecash');
  await press('Paste ecash');
  expect(mockClipboard).toHaveBeenCalledTimes(1);
  expect(options().every((option) => option.props.disabled)).toBe(true);
  await press('Close');
  await act(async () => resolve('late-token'));
  expect(mockPush).not.toHaveBeenCalled();
});

it('keeps automatic input routing available in the second step', async () => {
  await open('send');
  await press('Bitcoin');
  expect(input().props.label).toBe('Payment details');
  await act(async () => input().props.onBeforeRedirect());
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});
