import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAppShortcuts } from '~/shared/hooks/useAppShortcuts';
import { appShortcuts, queueAppShortcut } from '~/services/platform/appShortcuts';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';
import { redirectSystemPath } from '~/shared/utils/systemIntent';
const mockPush = jest.fn();
const mockPresent = jest.fn();
const mockRouter = { push: mockPush };
let mockRecovering = false;
let mockNativeSession = false;
let mockAppState: (state: string) => void;
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('~/features/nfc/nativeIntent', () => ({
  redirectNfcIntent: ({ path }: { path: string }) => path,
}));
jest.mock('~/state/recoverySessionStore', () => ({
  useRecoverySessionStore: (select: any) =>
    select({ session: { phase: mockRecovering ? 'recovering' : 'completed' } }),
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: (select: any) => select({ isLockDisabled: mockNativeSession }),
}));
const Sheet = React.forwardRef((_props, ref) => {
  React.useImperativeHandle(ref, () => ({ present: mockPresent }));
  return null;
});
function Host({ ready = true }: { ready?: boolean }) {
  const shortcut = useAppShortcuts(ready);
  return shortcut.receiveMounted ? <Sheet ref={shortcut.sheet} /> : null;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockRecovering = false;
  mockNativeSession = false;
  const pending = appShortcuts.getSnapshot();
  if (pending) appShortcuts.consume(pending.id);
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback: any) => {
    mockAppState = callback;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});
async function open(ready = true) {
  await act(async () => {
    tree = create(<Host ready={ready} />);
  });
}
it('queues cold shortcuts for startup/unlock and handles warm shortcuts without changing routes first', async () => {
  expect(redirectSystemPath({ path: 'bey-wallet:///shortcut/scan', initial: true })).toBe(
    '/(tabs)',
  );
  await open(false);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => tree.update(<Host />));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/scanner',
    params: { returnTo: '/receive' },
  });
  expect(appShortcuts.getSnapshot()).toBeNull();
  await act(async () => {
    expect(redirectSystemPath({ path: 'bey-wallet:///shortcut/receive', initial: false })).toBe('');
  });
  expect(mockPresent).toHaveBeenCalledWith('receive');
});
it('retains only the latest shortcut during an active operation and runs once after release', async () => {
  const release = feedbackNavigationGuard.acquire();
  await open();
  await act(async () => {
    queueAppShortcut('bey-wallet:///shortcut/scan');
    queueAppShortcut('bey-wallet:///shortcut/receive');
  });
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockPresent).not.toHaveBeenCalled();
  await act(async () => release());
  expect(mockPresent).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Host />));
  expect(mockPresent).toHaveBeenCalledTimes(1);
});
it('waits through recovery, native sessions, and backgrounding', async () => {
  mockRecovering = true;
  await open();
  await act(async () => {
    queueAppShortcut('bey-wallet:///shortcut/scan');
  });
  expect(mockPush).not.toHaveBeenCalled();
  mockRecovering = false;
  mockNativeSession = true;
  await act(async () => tree.update(<Host />));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => mockAppState('background'));
  mockNativeSession = false;
  await act(async () => tree.update(<Host />));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => mockAppState('active'));
  expect(mockPush).toHaveBeenCalledTimes(1);
});
it.each([
  'https://example.com/shortcut/scan',
  'bey-wallet:///shortcut/send',
  'bey-wallet:///shortcut/scan?token=private',
  'bey-wallet:///shortcut/receive#extra',
])('rejects unrecognized actions and payloads (%s)', (path) => {
  expect(queueAppShortcut(path)).toBe(false);
  expect(redirectSystemPath({ path, initial: false })).toBe(path);
  expect(appShortcuts.getSnapshot()).toBeNull();
});
