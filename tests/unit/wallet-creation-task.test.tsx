import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WalletCreationTask } from '~/features/onboarding/WalletCreationTask';
import * as Haptics from 'expo-haptics';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('starts immediately, runs once across rerenders, and awaits real completion', async () => {
  const generateMnemonic = jest.fn(() => 'test-only-generated-phrase');
  let finish!: () => void;
  const completion = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onComplete = jest.fn(() => completion);
  const onError = jest.fn();
  let tree!: ReactTestRenderer;
  const render = () => (
    <WalletCreationTask
      open
      generateMnemonic={generateMnemonic}
      onComplete={onComplete}
      onError={onError}
    />
  );
  await act(async () => {
    tree = create(render());
  });
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(render()));
  expect(generateMnemonic).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith('test-only-generated-phrase');
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  expect(onError).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('reports a creation failure without pretending setup completed', async () => {
  const failure = new Error('Generation failed');
  const onComplete = jest.fn();
  const onError = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <WalletCreationTask
        open
        generateMnemonic={() => {
          throw failure;
        }}
        onComplete={onComplete}
        onError={onError}
      />,
    );
  });
  expect(onError).toHaveBeenCalledWith(failure);
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('reports completion failures without success feedback', async () => {
  const failure = new Error('Setup failed');
  const onError = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <WalletCreationTask
        open
        generateMnemonic={() => 'test-only-generated-phrase'}
        onComplete={async () => {
          throw failure;
        }}
        onError={onError}
      />,
    );
  });
  expect(onError).toHaveBeenCalledWith(failure);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
