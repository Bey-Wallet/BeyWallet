import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useRecoveryHandoff } from '~/shared/hooks/useRecoveryHandoff';
import RecoveryStatusRow from '~/features/home/components/RecoveryStatusRow';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPath = '/';
let mockReady = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useRootNavigationState: () => (mockReady ? { key: 'ready' } : undefined),
  usePathname: () => mockPath,
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('@tamagui/lucide-icons', () => ({
  AlertCircle: 'AlertCircle',
  ChevronRight: 'ChevronRight',
}));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Row' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
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
  expect(mockReplace).not.toHaveBeenCalled();
  mockReady = true;
  await act(async () => tree.update(<Handoff />));
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings/recover-funds');
  mockPath = '/settings/recover-funds';
  await act(async () => tree.update(<Handoff />));
  expect(tree.toJSON()).toBe('false');
  mockPath = '/settings';
  await act(async () => tree.update(<Handoff />));
  expect(tree.toJSON()).toBe('false');
  expect(mockReplace).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('Home recovery row navigates directly and never mounts a sheet', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RecoveryStatusRow />);
  });
  const row = tree.root.findByType('Row' as any);
  expect(row.props.accessibilityLabel).toBe('Recovery needs review');
  row.props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/recover-funds');
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(1);
  await act(async () => tree.unmount());
});
