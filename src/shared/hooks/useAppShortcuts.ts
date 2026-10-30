import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { appShortcuts } from '~/services/platform/appShortcuts';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
import { useAuthStore } from '~/state/authStore';
import type { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';

/** Runs only after startup/authentication, outside recovery and in-flight wallet operations. */
export function useAppShortcuts(enabled: boolean) {
  const router = useRouter();
  const sheet = useRef<ActionSelectorSheetRef>(null);
  const [receiveMounted, setReceiveMounted] = useState(false);
  const pending = useSyncExternalStore(
    appShortcuts.subscribe,
    appShortcuts.getSnapshot,
    appShortcuts.getSnapshot,
  );
  const blocked = useSyncExternalStore(
    feedbackNavigationGuard.subscribe,
    feedbackNavigationGuard.getSnapshot,
    feedbackNavigationGuard.getSnapshot,
  );
  const recovering = useRecoverySessionStore((state) => state.session?.phase === 'recovering');
  const nativeSession = useAuthStore((state) => state.isLockDisabled);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (
      !enabled ||
      !active ||
      AppState.currentState !== 'active' ||
      blocked ||
      feedbackNavigationGuard.blocked ||
      recovering ||
      nativeSession ||
      !pending
    )
      return;
    if (pending.action === 'receive' && !sheet.current) {
      setReceiveMounted(true);
      return;
    }
    if (!appShortcuts.consume(pending.id)) return;
    if (pending.action === 'scan') {
      router.push({ pathname: '/(modals)/scanner', params: { returnTo: '/receive' } });
    } else sheet.current?.present('receive');
  }, [enabled, active, blocked, recovering, nativeSession, pending, router, receiveMounted]);
  return { sheet, receiveMounted };
}
