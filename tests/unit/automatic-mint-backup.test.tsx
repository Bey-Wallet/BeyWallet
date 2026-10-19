import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAutomaticMintBackup } from '~/shared/hooks/useAutomaticMintBackup';

const mockPublish = jest.fn(async () => 'published');
let mockStateChange: (state: string) => void;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockStateChange = listener;
      return { remove: mockRemove };
    },
  },
}));
jest.mock('~/services/wallet/mintBackupService', () => ({
  publishMintBackup: (...args: unknown[]) => mockPublish(...(args as [])),
}));
function Harness({ ready }: { ready: boolean }) {
  useAutomaticMintBackup(ready);
  return null;
}
it('backs up when ready and after real backgrounding, but not permission-dialog transitions', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Harness ready={false} />);
  });
  expect(mockPublish).not.toHaveBeenCalled();
  await act(async () => tree.update(<Harness ready />));
  expect(mockPublish).toHaveBeenCalledTimes(1);
  expect(mockPublish).toHaveBeenLastCalledWith(true);
  await act(async () => {
    mockStateChange('inactive');
    mockStateChange('active');
  });
  expect(mockPublish).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockStateChange('background');
    mockStateChange('inactive');
    mockStateChange('active');
  });
  expect(mockPublish).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
  expect(mockRemove).toHaveBeenCalledTimes(1);
});
