import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppFeedback } from '~/shared/hooks/useAppFeedback';
import { feedbackCoordinator } from '~/services/feedback/feedbackCoordinator';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';

const mockRouter = { push: jest.fn() };
const mockToast = { show: jest.fn(), hide: jest.fn() };
const mockTarget = jest.fn();
const mockEntry = jest.fn();
let mockAuthenticated = false;
let mockResponse: (response: any) => void;
let mockPath = '/history';
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => mockPath }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockToast }));
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn((callback) => {
    mockResponse = callback;
    return { remove: jest.fn() };
  }),
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('~/services/feedback/deliveryIdentifier', () => ({
  deliveryIdentifier: jest.fn(async () => 'a'.repeat(64)),
}));
jest.mock('~/services/platform/notificationService', () => ({
  notificationService: { initialize: jest.fn(async () => {}), deliver: jest.fn(async () => {}) },
}));
jest.mock('~/storage/sqlite/repositories/FeedbackRepository', () => ({
  FeedbackRepository: jest.fn(() => ({ target: (...args: unknown[]) => mockTarget(...args) })),
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    isInitialized: () => true,
    getRepo: () => ({
      db: {},
      historyRepository: { getHistoryEntryById: (...args: unknown[]) => mockEntry(...args) },
    }),
  },
}));
jest.mock('~/services/wallet/recoveryCoordinator', () => ({
  recoveryCoordinator: { paused: false },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ initialized: true, biometricEnabled: true, hideBalance: false }),
    subscribe: () => () => {},
  },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({ isAuthenticated: mockAuthenticated, isLockDisabled: false }),
    subscribe: () => () => {},
  },
}));
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: { getState: () => ({ isOnboarded: true }) },
}));
jest.mock('~/state/peopleStore', () => ({ usePeopleStore: { getState: () => ({ people: {} }) } }));
jest.mock('~/state/nostrInboxStore', () => ({
  useNostrInboxStore: { getState: () => ({ items: [] }) },
}));

const response = {
  notification: { request: { content: { data: { feedbackId: 'a'.repeat(64) } } } },
};
function Host() {
  useAppFeedback();
  return null;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (AppState as any).currentState = 'active';
  mockAuthenticated = false;
  mockPath = '/history';
  feedbackCoordinator.clear();
  feedbackCoordinator.bind('wallet-a', { reserve: async () => true });
  (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
  mockTarget.mockResolvedValue({ type: 'transaction', id: '12' });
  mockEntry.mockResolvedValue({ id: '12' });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  feedbackCoordinator.clear();
  jest.useRealTimers();
});
async function render() {
  await act(async () => {
    tree = create(<Host />);
  });
}
async function tick() {
  await act(async () => jest.advanceTimersByTime(500));
}

it('holds cold-start taps behind authentication and clears the consumed native response', async () => {
  (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(response);
  await render();
  await tick();
  expect(mockRouter.push).not.toHaveBeenCalled();
  mockAuthenticated = true;
  await tick();
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/(modals)/txn-details',
    params: { id: '12' },
  });
  expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  mockResponse(response);
  await tick();
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it('queues warm taps during protected operations and navigates only after release', async () => {
  mockAuthenticated = true;
  await render();
  const release = feedbackNavigationGuard.acquire();
  mockResponse(response);
  await tick();
  expect(mockTarget).not.toHaveBeenCalled();
  release();
  await tick();
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it('falls back from a deleted receipt with a brief explanation and never emits a claim action', async () => {
  mockAuthenticated = true;
  mockEntry.mockResolvedValue(null);
  const emit = jest.spyOn(DeviceEventEmitter, 'emit');
  await render();
  mockResponse(response);
  await tick();
  expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/history');
  expect(mockToast.show).toHaveBeenCalledWith(
    'Item no longer available',
    expect.objectContaining({ kind: 'info', duration: 3000 }),
  );
  expect(emit).not.toHaveBeenCalledWith('nostr:openClaim', expect.anything());
  emit.mockRestore();
});

it('discards obsolete wallet targets and arbitrary URL payloads', async () => {
  await render();
  mockResponse(response);
  await tick();
  feedbackCoordinator.bind('wallet-b', { reserve: async () => true });
  mockAuthenticated = true;
  await tick();
  mockResponse({
    notification: { request: { content: { data: { url: 'https://example.org/pay' } } } },
  });
  await tick();
  expect(mockRouter.push).not.toHaveBeenCalled();
});
