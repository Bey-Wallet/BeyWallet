import { useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useOfflineStatus } from './useOfflineStatus';

export const PENDING_PAYMENT_CHECK_MS = 2_000;

/** Screen-local fallback; event subscriptions remain the primary payment signal. */
export function usePaymentListening(enabled: boolean): boolean {
  const navigation = useContext(NavigationContext);
  const offline = useOfflineStatus();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    setFocused(navigation?.isFocused() ?? true);
    const focus = navigation?.addListener('focus', () => setFocused(true));
    const blur = navigation?.addListener('blur', () => setFocused(false));
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => {
      focus?.();
      blur?.();
      app.remove();
    };
  }, [navigation]);
  return enabled && !offline && foreground && focused;
}

export function usePendingPaymentPolling(check: () => Promise<void> | void, enabled: boolean) {
  const listening = usePaymentListening(enabled);
  const callback = useRef(check);
  callback.current = check;
  const running = useRef(false);
  useEffect(() => {
    if (!listening) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      if (!running.current) {
        running.current = true;
        try {
          await callback.current();
        } catch {
          // A failed observation is not a failed payment. Try again while visible.
        } finally {
          running.current = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, PENDING_PAYMENT_CHECK_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [listening]);
  return listening;
}
