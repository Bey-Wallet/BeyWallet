import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WalletCreationTask } from '~/features/onboarding/WalletCreationTask';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('runs the existing sequence once across rerenders and awaits its completion callback', async () => {
  const generateMnemonic = jest.fn(() => 'test-only-generated-phrase');
  const onComplete = jest.fn(async () => {});
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
  for (const delay of [800, 600, 700, 500]) await act(async () => jest.advanceTimersByTime(delay));
  expect(generateMnemonic).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(400));
  expect(onComplete).toHaveBeenCalledWith('test-only-generated-phrase');
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
  await act(async () => jest.advanceTimersByTime(800));
  await act(async () => jest.advanceTimersByTime(600));
  expect(onError).toHaveBeenCalledWith(failure);
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
