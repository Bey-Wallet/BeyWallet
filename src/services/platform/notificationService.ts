import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '~/state/authStore';
import { feedbackCatalog } from '~/services/feedback/feedbackCatalog';
import { feedbackCoordinator, type FeedbackEvent } from '~/services/feedback/feedbackCoordinator';
import { useSettingsStore } from '~/state/settingsStore';
import { deliveryIdentifier } from '~/services/feedback/deliveryIdentifier';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const settings = useSettingsStore.getState();
    const unlocked =
      settings.initialized &&
      (!settings.biometricEnabled || useAuthStore.getState().isAuthenticated);
    const show = AppState.currentState !== 'active' || !unlocked;
    return {
      shouldShowAlert: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
      shouldShowBanner: show,
      shouldShowList: show,
    };
  },
});

export class NotificationService {
  private permissionRequest?: Promise<boolean>;
  async initialize() {
    try {
      if (
        Platform.OS === 'android' &&
        !(await Notifications.getNotificationChannelAsync('default'))
      ) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Wallet activity',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    } catch {
      /* Native notifications may be unavailable in a preview client. */
    }
  }

  async permissionStatus(): Promise<string> {
    try {
      return (await Notifications.getPermissionsAsync()).status;
    } catch {
      return 'unavailable';
    }
  }

  /** Call only from a user action. Delivery never requests permission. */
  requestPermissions() {
    return (this.permissionRequest ??= this.askPermissions().finally(() => {
      this.permissionRequest = undefined;
    }));
  }

  private async askPermissions() {
    await this.initialize();
    const auth = useAuthStore.getState();
    const previous = auth.isLockDisabled;
    try {
      if ((await this.permissionStatus()) === 'granted') return true;
      auth.setLockDisabled(true);
      return (await Notifications.requestPermissionsAsync()).status === 'granted';
    } catch {
      return false;
    } finally {
      auth.setLockDisabled(previous);
    }
  }

  async deliver(events: FeedbackEvent[]) {
    await this.initialize();
    const settings = useSettingsStore.getState();
    if (
      !settings.initialized ||
      !settings.notificationsEnabled ||
      (await this.permissionStatus()) !== 'granted'
    )
      return;
    const eligible = events.filter(
      (event) => settings.notificationPreferences[feedbackCatalog[event.kind].category],
    );
    if (!eligible.length) return;
    const event = eligible[0];
    const copy = feedbackCatalog[event.kind];
    const identifier = await deliveryIdentifier(event);
    if (feedbackCoordinator.wallet !== event.walletId) return;
    const latest = useSettingsStore.getState();
    if (!latest.notificationsEnabled || !latest.notificationPreferences[copy.category]) return;
    const unlocked = !latest.biometricEnabled || useAuthStore.getState().isAuthenticated;
    const details = latest.notificationPreferences.details && unlocked && !latest.hideBalance;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: eligible.length > 1 ? 'New wallet activity' : copy.title,
          body:
            eligible.length > 1
              ? 'Open Bey to view recent activity.'
              : details && event.details
                ? `${event.details.amount.toLocaleString()} sat. ${copy.body}`
                : copy.body,
          data: { feedbackId: identifier, summary: eligible.length > 1 },
          sound: true,
        },
        trigger: null,
      });
    } catch {
      console.warn('[Notifications] delivery unavailable');
    }
  }

  async clear() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.clearLastNotificationResponseAsync();
    } catch {
      /* Best effort on wallet lifecycle changes. */
    }
  }
}
export const notificationService = new NotificationService();
