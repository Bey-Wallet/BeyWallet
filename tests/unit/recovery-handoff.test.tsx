import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useRecoveryHandoff } from '~/shared/hooks/useRecoveryHandoff';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
const mockPush = jest.fn();
let mockPath = '/';
let mockReady = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => (mockReady ? { key: 'ready' } : undefined),
  usePathname: () => mockPath,
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
function Handoff() {
  return <>{String(useRecoveryHandoff())}</>;
}
it('covers Home until navigation is ready, opens recovery once, and permits leaving review', async () => {
  useRecoverySessionStore.setState({
    session: {
      walletId: 'public-id',
      origin: 'import',
      phase: 'review',
      needsReview: true,
      candidates: [],
      selected: [],
      results: [],
    },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Handoff />);
  });
  expect(tree.toJSON()).toBe('true');
  expect(mockPush).not.toHaveBeenCalled();
  mockReady = true;
  await act(async () => tree.update(<Handoff />));
  expect(mockPush).toHaveBeenCalledWith('/recover-funds');
  await act(async () => tree.update(<Handoff />));
  expect(mockPush).toHaveBeenCalledTimes(1);
  mockPath = '/recover-funds';
  await act(async () => tree.update(<Handoff />));
  expect(tree.toJSON()).toBe('false');
  mockPath = '/settings';
  await act(async () => tree.update(<Handoff />));
  expect(tree.toJSON()).toBe('false');
  expect(mockPush).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
