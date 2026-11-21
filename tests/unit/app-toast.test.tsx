import React from 'react';
import { Dimensions } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppToast } from '~/shared/ui/AppToast';
import * as Haptics from 'expo-haptics';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

let mockToast: Record<string, unknown> | null;
const mockHide = jest.fn();
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@tamagui/toast', () => ({
  useToastState: () => mockToast,
  useToastController: () => ({ hide: mockHide }),
  Toast: Object.assign((props: unknown) => require('react').createElement('Toast', props), {
    Title: 'ToastTitle',
    Description: 'ToastDescription',
  }),
}));
jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppTextButton', () => ({ AppTextButton: 'AppTextButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@tamagui/lucide-icons', () => ({
  X: 'X',
  AlertTriangle: 'AlertTriangle',
  Check: 'Check',
  Info: 'Info',
}));

it('uses explicit severity, compact explanatory copy and reduced motion without producing haptics', async () => {
  mockToast = {
    id: 'one',
    title: 'Checking payment',
    message: 'Awaiting receipt.',
    customData: { kind: 'info', essentialDescription: true },
  };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppToast />);
  });
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('Info' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('ToastDescription' as any)).toHaveLength(1);
  expect(tree.root.findByType('ToastTitle' as any).props).toMatchObject({
    children: 'Checking payment',
    fontSize: 14,
    fontWeight: '400',
  });
  expect(tree.root.findByType('Info' as any).props).toMatchObject({ size: 20, strokeWidth: 2 });
  expect(tree.root.findByType('Toast' as any).props).toMatchObject({
    width: 'auto',
    rounded: '$6',
    bg: '$gray2',
    themeInverse: false,
    minHeight: 48,
  });
  expect(tree.root.findByType('ToastDescription' as any).props.numberOfLines).toBeUndefined();
  mockToast = { id: 'two', title: 'Received', kind: 'loading' };
  await act(async () => tree.update(<AppToast />));
  expect(tree.root.findByType('Spinner' as any).props).toMatchObject({
    size: 22,
    strokeWidth: 3,
    reduceMotion: true,
  });
  const calls = (Haptics.notificationAsync as jest.Mock).mock.calls.length;
  expect(calls).toBe(0);
  await act(async () => tree.update(<AppToast />));
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(calls);
  await act(async () => tree.unmount());
});

it('uses the same compact style for action toasts with an accessible View target', async () => {
  mockToast = {
    id: 'action',
    title: 'Received 10 sat via Nostr',
    message: 'Legacy description',
    kind: 'success',
    customData: { variant: 'action', actionLabel: 'View', onAction: jest.fn() },
  };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppToast />);
  });
  expect(tree.root.findAllByType('ToastTitle' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('ToastDescription' as any)).toHaveLength(0);
  expect(tree.root.findByType('ToastTitle' as any).props).toMatchObject({
    children: 'Received 10 sat via Nostr',
    fontSize: 14,
    fontWeight: '400',
    color: '$toastSuccessForeground',
  });
  expect(tree.root.findByType('Check' as any).props).toMatchObject({
    size: 20,
    strokeWidth: 2.5,
    color: '$toastSuccessForeground',
  });
  expect(tree.root.findByType('AppTextButton' as any).props.children).toBe('View');
  await act(async () => tree.unmount());
});

it('dismisses the current toast before running an action that may show another toast', async () => {
  const calls: string[] = [];
  mockHide.mockImplementationOnce(() => calls.push('hide'));
  const onAction = jest.fn(() => calls.push('action'));
  mockToast = {
    id: 'action-order',
    title: 'Payment needs review',
    customData: { variant: 'action', actionLabel: 'View', onAction },
  };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppToast />);
  });
  await act(async () => tree.root.findByType('AppTextButton' as any).props.onPress());
  expect(calls).toEqual(['hide', 'action']);
  expect(onAction).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('top-aligns measured multiline titles and returns to centered alignment for a single line', async () => {
  mockToast = { id: 'wrap', title: 'A notice that wraps on a narrow display', kind: 'warning' };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppToast />);
  });
  const icon = () => tree.root.findByType('AlertTriangle' as any);
  const lineHeight = 22 * Dimensions.get('window').fontScale;
  expect(icon().props.color).toBe('$toastWarningForeground');
  await act(async () =>
    tree.root
      .findByType('ToastTitle' as any)
      .parent!.props.onLayout({ nativeEvent: { layout: { height: lineHeight * 2 } } }),
  );
  expect(icon().parent!.parent!.props.items).toBe('flex-start');
  expect(tree.root.findByType('ToastTitle' as any).props.color).toBe(icon().props.color);
  await act(async () =>
    tree.root
      .findByType('ToastTitle' as any)
      .parent!.props.onLayout({ nativeEvent: { layout: { height: lineHeight } } }),
  );
  expect(icon().parent!.parent!.props.items).toBe('center');
  await act(async () => tree.unmount());
});
