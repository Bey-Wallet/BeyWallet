import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    addEventListener: jest.fn(),
    isReduceMotionEnabled: jest.fn(),
  },
}));

const deferred = () => {
  let resolve!: (value: boolean) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<boolean>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const snapshots = new Map<number, boolean>();
const renderConsumer = jest.fn();
const subscriptions: Array<{ listener: (value: boolean) => void; remove: jest.Mock }> = [];
let initialRead: ReturnType<typeof deferred>;
let tree: ReactTestRenderer | undefined;

function Consumer({ id }: { id: number }) {
  const value = useReducedMotion();
  snapshots.set(id, value);
  renderConsumer(id, value);
  return null;
}
function Controls({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, id) => (
        <Consumer key={id} id={id} />
      ))}
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  snapshots.clear();
  subscriptions.length = 0;
  initialRead = deferred();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(initialRead.promise);
  (AccessibilityInfo.addEventListener as jest.Mock).mockImplementation(
    (_event: string, callback: (value: boolean) => void) => {
      const subscription = { listener: callback, remove: jest.fn() };
      subscriptions.push(subscription);
      return subscription;
    },
  );
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});
const mount = async (count = 2) => {
  await act(async () => {
    tree = create(<Controls count={count} />);
  });
};

it('shares one native listener and preference read across 100 mounted controls', async () => {
  await mount(100);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
  expect([...snapshots.values()]).toEqual(Array(100).fill(true));
  await act(async () => initialRead.resolve(false));
  expect([...snapshots.values()]).toEqual(Array(100).fill(false));
});

it('keeps the shared listener while any consumer remains and removes it after the last unmount', async () => {
  await mount(10);
  await act(async () => tree!.update(<Controls count={1} />));
  expect(subscriptions[0].remove).not.toHaveBeenCalled();
  await act(async () => tree!.unmount());
  tree = undefined;
  expect(subscriptions[0].remove).toHaveBeenCalledTimes(1);
});

it('applies live preference changes to every consumer and ignores an older initial read', async () => {
  await mount();
  await act(async () => subscriptions[0].listener(false));
  expect([...snapshots.values()]).toEqual([false, false]);
  await act(async () => initialRead.resolve(true));
  expect([...snapshots.values()]).toEqual([false, false]);
  await act(async () => subscriptions[0].listener(true));
  expect([...snapshots.values()]).toEqual([true, true]);
});

it('keeps motion reduced when the read fails and still accepts later native events', async () => {
  await mount();
  await act(async () => initialRead.reject(new Error('Preference unavailable')));
  expect([...snapshots.values()]).toEqual([true, true]);
  await act(async () => subscriptions[0].listener(false));
  expect([...snapshots.values()]).toEqual([false, false]);
});

it('re-reads after all consumers unmount and ignores callbacks from the previous subscription', async () => {
  await mount();
  const previous = subscriptions[0];
  await act(async () => tree!.unmount());
  tree = undefined;
  const nextRead = deferred();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(nextRead.promise);
  await mount();
  expect([...snapshots.values()]).toEqual([true, true]);
  expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(2);
  await act(async () => nextRead.resolve(false));
  await act(async () => {
    initialRead.resolve(true);
    previous.listener(true);
  });
  expect([...snapshots.values()]).toEqual([false, false]);
});

it('does not re-render consumers for repeated events with an unchanged preference', async () => {
  await mount();
  const before = renderConsumer.mock.calls.length;
  await act(async () => subscriptions[0].listener(true));
  expect(renderConsumer).toHaveBeenCalledTimes(before);
  await act(async () => subscriptions[0].listener(false));
  const changed = renderConsumer.mock.calls.length;
  expect(changed).toBeGreaterThan(before);
  await act(async () => subscriptions[0].listener(false));
  expect(renderConsumer).toHaveBeenCalledTimes(changed);
});
