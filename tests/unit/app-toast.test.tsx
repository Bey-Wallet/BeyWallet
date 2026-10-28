import React from 'react';
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
jest.mock('@tamagui/toast', () => ({
  useToastState: () => mockToast,
  useToastController: () => ({ hide: jest.fn() }),
  Toast: Object.assign((props: unknown) => require('react').createElement('Toast', props), {
    Title: 'ToastTitle',
    Description: 'ToastDescription',
  }),
}));
jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@tamagui/lucide-icons', () => ({
  AlertCircle: 'AlertCircle',
  Check: 'Check',
  Info: 'Info',
}));

it('uses explicit severity, compact explanatory copy and reduced motion without producing haptics', async () => {
  mockToast = {
    id: 'one',
    title: 'Checking payment',
    message: 'Awaiting receipt.',
    customData: { kind: 'info' },
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
    fontWeight: '600',
  });
  expect(tree.root.findByType('Info' as any).props).toMatchObject({ size: 16, strokeWidth: 3 });
  mockToast = { id: 'two', title: 'Received', kind: 'loading' };
  await act(async () => tree.update(<AppToast />));
  expect(tree.root.findByType('Spinner' as any).props).toMatchObject({
    size: 16,
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
  expect(tree.root.findAllByType('ToastDescription' as any)).toHaveLength(1);
  expect(tree.root.findByType('ToastTitle' as any).props).toMatchObject({
    children: 'Received 10 sat via Nostr',
    fontSize: 14,
    fontWeight: '600',
  });
  expect(tree.root.findByType('Check' as any).props).toMatchObject({ size: 16, strokeWidth: 3 });
  expect(tree.root.findByType('AppButton' as any).props.children).toBe('View');
  expect(tree.root.findByType('AppButton' as any).props.minHeight).toBe(48);
  await act(async () => tree.unmount());
});
