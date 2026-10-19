import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { useProtectedValue } from '~/features/settings/hooks/useProtectedValue';

const mockAuthenticate = jest.fn();
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: (...args: unknown[]) => mockAuthenticate(...args) },
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

it('gates direct entry, clears on background, and discards late authentication results', async () => {
  let state!: ReturnType<typeof useProtectedValue<string>>;
  const read = jest.fn(async () => 'protected-test-value');
  let onAppState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    onAppState = callback;
    return { remove };
  });
  function Screen() {
    state = useProtectedValue('Authorize', read);
    return null;
  }
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Screen />);
  });
  expect(state.value).toBeNull();
  expect(read).not.toHaveBeenCalled();
  mockAuthenticate.mockResolvedValueOnce(false);
  await act(async () => state.reveal());
  expect(state.value).toBeNull();
  expect(read).not.toHaveBeenCalled();
  mockAuthenticate.mockResolvedValueOnce(true);
  await act(async () => state.reveal());
  expect(state.value).toBe('protected-test-value');
  await act(async () => onAppState('background'));
  expect(state.value).toBeNull();
  let complete!: (value: boolean) => void;
  mockAuthenticate.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.reveal();
  });
  await act(async () => onAppState('background'));
  await act(async () => {
    complete(true);
    await pending;
  });
  expect(state.value).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  expect(remove).toHaveBeenCalled();
  listener.mockRestore();
});
