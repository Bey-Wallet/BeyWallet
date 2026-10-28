import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useResultHaptic } from '~/shared/hooks/useResultHaptic';
let mockAuthenticated = true;
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ biometricEnabled: true }) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: mockAuthenticated }) },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
function Result({ status, id }: { status?: 'success' | 'pending'; id?: string }) {
  useResultHaptic(status, id);
  return null;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  (AppState as any).currentState = 'active';
  mockAuthenticated = true;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('does not replay an NFC outcome haptic when the finished sheet is reopened', async () => {
  await act(async () => {
    tree = create(<Result status="success" id="receipt" />);
  });
  await act(async () => tree.update(<Result id="receipt" />));
  await act(async () => tree.update(<Result status="success" id="receipt" />));
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
});

it('does not vibrate behind a wallet lock or replay a background result on reopening', async () => {
  mockAuthenticated = false;
  await act(async () => {
    tree = create(<Result status="success" id="locked" />);
  });
  mockAuthenticated = true;
  (AppState as any).currentState = 'background';
  await act(async () => tree.update(<Result status="success" id="background" />));
  (AppState as any).currentState = 'active';
  await act(async () => tree.update(<Result id="background" />));
  await act(async () => tree.update(<Result status="success" id="background" />));
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
