import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ModalLayout from '~/app/(modals)/_layout';
import ActionSelectorSheet, { type ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockDismiss = jest.fn();
let mockRoute = 'send';
let mockCanGoBack = true;
jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = ({ screenOptions }: any) => {
    const options = screenOptions({ route: { name: mockRoute } });
    return React.createElement('Header', null, options.headerLeft());
  };
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
  };
});
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  View: 'View',
  useTheme: () => ({ background: { val: '#000' } }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  ArrowLeft: 'ArrowLeft',
  X: 'X',
  Banknote: 'Banknote',
  Bitcoin: 'Bitcoin',
  Zap: 'Zap',
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'ScrollView' }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('~/shared/ui/useScreenHeaderOptions', () => ({ useScreenHeaderOptions: () => ({}) }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ __esModule: true, default: () => null }));
jest.mock('~/shared/ui/UniversalInputCard', () => ({ UniversalInputCard: 'InputCard' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: mockDismiss }));
      return React.createElement('Sheet', null, children);
    }),
  };
});

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each([
  ['send', 'Close', 'X'],
  ['scanner', 'Close', 'X'],
  ['nostr-settings', 'Back', 'ArrowLeft'],
  ['mint-profile', 'Back', 'ArrowLeft'],
  ['txn-details', 'Back', 'ArrowLeft'],
  ['token-details', 'Back', 'ArrowLeft'],
])('uses the appropriate leading control for %s', async (route, label, icon) => {
  mockRoute = route;
  await act(async () => {
    tree = create(<ModalLayout />);
  });
  const button = tree.root.findByType('IconButton' as any);
  expect(button.props).toMatchObject({ accessibilityLabel: label, icon, iconSize: 22 });
  button.props.onPress();
  expect(mockBack).toHaveBeenCalledTimes(1);
  mockCanGoBack = false;
  button.props.onPress();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

it('uses one left close control at the sheet root and a back arrow for nested choices', async () => {
  const ref = React.createRef<ActionSelectorSheetRef>();
  await act(async () => {
    tree = create(<ActionSelectorSheet ref={ref} />);
  });
  await act(async () => ref.current!.present('send'));
  const button = () => tree.root.findByType('IconButton' as any);
  expect(button().props).toMatchObject({ accessibilityLabel: 'Close', icon: 'X' });
  const bitcoin = tree.root
    .findAllByType('Pressable' as any)
    .find((node) => node.props.accessibilityLabel === 'Bitcoin')!;
  await act(async () => bitcoin.props.onPress());
  expect(button().props).toMatchObject({ accessibilityLabel: 'Back', icon: 'ArrowLeft' });
  await act(async () => button().props.onPress());
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(button().props.accessibilityLabel).toBe('Close');
  await act(async () => button().props.onPress());
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});
