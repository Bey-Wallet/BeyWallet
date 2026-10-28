import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';

/** Outcome-only feedback: never vibrate behind the lock screen or in background. */
export function useResultHaptic(
  status: 'success' | 'error' | 'pending' | 'cancelled' | undefined,
  outcomeId?: string | number,
) {
  const delivered = useRef(new Set<string>());
  useEffect(() => {
    if (status !== 'success' && status !== 'error') return;
    if (outcomeId !== undefined) {
      const key = `${outcomeId}:${status}`;
      if (delivered.current.has(key)) return;
      delivered.current.add(key);
    }
    const settings = useSettingsStore.getState();
    if (
      AppState.currentState !== 'active' ||
      (settings.biometricEnabled && !useAuthStore.getState().isAuthenticated)
    )
      return;
    void Promise.resolve(
      Haptics.notificationAsync(
        status === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ),
    ).catch(() => {});
  }, [status, outcomeId]);
}
