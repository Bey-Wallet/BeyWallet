import * as Notifications from 'expo-notifications';
import { NotificationService } from '~/services/platform/notificationService';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import type { FeedbackEvent } from '~/services/feedback/feedbackCoordinator';
import { feedbackCoordinator } from '~/services/feedback/feedbackCoordinator';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('~/services/feedback/deliveryIdentifier', () => ({
  deliveryIdentifier: jest.fn(async () => 'stable-id'),
}));
jest.mock('~/state/authStore', () => ({ useAuthStore: { getState: jest.fn() } }));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));

const event: FeedbackEvent = {
  walletId: 'wallet',
  entity: { type: 'receipt', id: 'receipt' },
  kind: 'received',
  state: 'completed',
  origin: 'live',
  details: { amount: 123 },
};
const defaults = {
  initialized: true,
  notificationsEnabled: true,
  biometricEnabled: true,
  hideBalance: false,
  notificationPreferences: { details: false, payments: true, messages: true, review: true },
};
const auth = { isAuthenticated: true, isLockDisabled: false, setLockDisabled: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  feedbackCoordinator.clear();
  feedbackCoordinator.bind('wallet', { reserve: async () => true });
  (useAuthStore.getState as jest.Mock).mockReturnValue(auth);
  (useSettingsStore.getState as jest.Mock).mockReturnValue(defaults);
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('stable-id');
});

it('uses private copy and opaque stable payloads; never requests permission during delivery', async () => {
  await new NotificationService().deliver([event]);
  const notification = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
  expect(notification).toMatchObject({
    identifier: 'stable-id',
    content: {
      title: 'Payment received',
      body: 'Open Bey to view your payment.',
      data: { feedbackId: 'stable-id' },
    },
  });
  expect(JSON.stringify(notification)).not.toContain('123');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it.each(['denied', 'undetermined', 'unavailable'])(
  'does not prompt or deliver with %s permission',
  async (status) => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status });
    await new NotificationService().deliver([event]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  },
);

it('respects disabled notifications and category preferences', async () => {
  (useSettingsStore.getState as jest.Mock).mockReturnValue({
    ...defaults,
    notificationsEnabled: false,
  });
  await new NotificationService().deliver([event]);
  (useSettingsStore.getState as jest.Mock).mockReturnValue({
    ...defaults,
    notificationPreferences: { ...defaults.notificationPreferences, payments: false },
  });
  await new NotificationService().deliver([event]);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('shares concurrent permission requests so overlapping prompts cannot leave authentication disabled', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  const service = new NotificationService();
  await expect(
    Promise.all([service.requestPermissions(), service.requestPermissions()]),
  ).resolves.toEqual([true, true]);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(auth.setLockDisabled.mock.calls).toEqual([[true], [false]]);
});

it.each([false, true])(
  'restores the previous authentication guard (%s) after a native prompt failure',
  async (previous) => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockRejectedValue(
      new Error('native error with private text'),
    );
    (useAuthStore.getState as jest.Mock).mockReturnValue({ ...auth, isLockDisabled: previous });
    await expect(new NotificationService().requestPermissions()).resolves.toBe(false);
    expect(auth.setLockDisabled.mock.calls).toEqual([[true], [previous]]);
  },
);

it('requires opt-in details and hides them again for locked or hidden-balance states', async () => {
  const settings = {
    ...defaults,
    notificationPreferences: { ...defaults.notificationPreferences, details: true },
  };
  (useSettingsStore.getState as jest.Mock).mockReturnValue(settings);
  const service = new NotificationService();
  await service.deliver([event]);
  expect(
    (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].content.body,
  ).toContain('123 sat');
  (useAuthStore.getState as jest.Mock).mockReturnValue({ ...auth, isAuthenticated: false });
  await service.deliver([event]);
  expect(
    (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[1][0].content.body,
  ).not.toContain('123');
  (useAuthStore.getState as jest.Mock).mockReturnValue(auth);
  (useSettingsStore.getState as jest.Mock).mockReturnValue({ ...settings, hideBalance: true });
  await service.deliver([event]);
  expect(
    (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[2][0].content.body,
  ).not.toContain('123');
});

it('summarizes a burst once without private values', async () => {
  await new NotificationService().deliver([
    event,
    { ...event, entity: { type: 'receipt', id: 'second' } },
  ]);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(
    (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].content,
  ).toMatchObject({
    title: 'New wallet activity',
    body: 'Open Bey to view recent activity.',
    data: { summary: true },
  });
});
