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

it('prefers explicit kinds, displays descriptions and preserves reduced motion for loading', async () => {
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
  expect(tree.root.findByType('ToastDescription' as any).props.children).toBe('Awaiting receipt.');
  mockToast = { id: 'two', title: 'Received', kind: 'loading' };
  await act(async () => tree.update(<AppToast />));
  expect(tree.root.findByType('Spinner' as any).props.reduceMotion).toBe(true);
  const calls = (Haptics.notificationAsync as jest.Mock).mock.calls.length;
  await act(async () => tree.update(<AppToast />));
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(calls);
  await act(async () => tree.unmount());
});
