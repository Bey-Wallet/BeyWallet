import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { OperationFeedbackProvider, usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { NavigationContext } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => ({
  NavigationContext: require('react').createContext(undefined),
}));

jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
jest.mock('@tamagui/toast', () => ({
  Toast: Object.assign((props: unknown) => require('react').createElement('Toast', props), {
    Title: 'ToastTitle',
    Description: 'ToastDescription',
  }),
}));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

function Operation({
  active = true,
  title = 'Creating ecash…',
}: {
  active?: boolean;
  title?: string;
}) {
  usePendingOperationToast({ active, title });
  return null;
}
let tree: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
});

it('keeps concurrent operations visible beyond timeouts and updates only the owning record', async () => {
  const render = (first: boolean, title: string) => (
    <OperationFeedbackProvider>
      <Operation key="first" active={first} title={title} />
      <Operation key="second" title="Receiving ecash…" />
      {React.createElement('ordinary-toast')}
    </OperationFeedbackProvider>
  );
  await act(async () => {
    tree = create(render(true, 'Creating ecash…'));
  });
  const second = tree.root.findAllByType('Toast' as any)[1];
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(2);
  expect(tree.root.findAllByType('ToastDescription' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('ToastTitle' as any)[0].props).toMatchObject({
    fontSize: 16,
    fontWeight: '800',
  });
  expect(tree.root.findAllByType('Spinner' as any)[0].props).toMatchObject({
    size: 16,
    strokeWidth: 3,
  });
  await act(async () => jest.advanceTimersByTime(120_000));
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(2);
  await act(async () => tree.update(render(true, 'Sending via Nostr…')));
  expect(tree.root.findAllByType('Toast' as any)[1]).toBe(second);
  expect(tree.root.findAllByType('ToastTitle' as any).map((n) => n.props.children)).toEqual([
    'Sending via Nostr…',
    'Receiving ecash…',
  ]);
  const toast = tree.root.findAllByType('Toast' as any)[0];
  expect(toast.props).toMatchObject({
    open: true,
    duration: Infinity,
    type: 'background',
    pointerEvents: 'none',
  });
  for (const handler of ['onEscapeKeyDown', 'onSwipeStart', 'onSwipeMove', 'onSwipeEnd']) {
    const preventDefault = jest.fn();
    toast.props[handler]({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  }
  await act(async () => tree.update(render(false, 'Sending via Nostr…')));
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('ordinary-toast' as any)).toHaveLength(1);
  await act(async () => tree.update(render(true, 'Creating ecash…')));
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(2);
});

it('hands progress from a disappearing button to a parent toast and cleans up on unmount', async () => {
  function Flow({ stage, working }: { stage: string; working: boolean }) {
    usePendingOperationToast({
      active: working && stage !== 'confirm',
      title: 'Sending via Nostr…',
    });
    return stage === 'confirm' ? React.createElement('button-progress', { active: working }) : null;
  }
  const render = (stage: string, working: boolean, show = true) => (
    <OperationFeedbackProvider>
      {show && <Flow stage={stage} working={working} />}
    </OperationFeedbackProvider>
  );
  await act(async () => {
    tree = create(render('confirm', true));
  });
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  expect(tree.root.findByType('button-progress' as any).props.active).toBe(true);
  await act(async () => tree.update(render('delivery', true)));
  expect(tree.root.findAllByType('button-progress' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(1);
  await act(async () => tree.update(render('delivery', false)));
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  await act(async () => tree.update(render('delivery', true)));
  await act(async () => tree.update(render('delivery', true, false)));
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
});

it('clears presentation on screen blur without cancelling work and restores it on focus', async () => {
  const listeners: Record<string, () => void> = {};
  let focused = true;
  const navigation = {
    isFocused: () => focused,
    addListener: (event: string, callback: () => void) => {
      listeners[event] = callback;
      return jest.fn();
    },
  };
  await act(async () => {
    tree = create(
      <OperationFeedbackProvider>
        <NavigationContext.Provider value={navigation as any}>
          <Operation />
        </NavigationContext.Provider>
      </OperationFeedbackProvider>,
    );
  });
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(1);
  await act(async () => {
    focused = false;
    listeners.blur();
  });
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  await act(async () => {
    focused = true;
    listeners.focus();
  });
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(1);
});
