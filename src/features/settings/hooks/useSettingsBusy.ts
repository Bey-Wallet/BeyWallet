import { usePreventRemove, usePreventRemoveContext, useRoute } from '@react-navigation/native';
import { useEffect } from 'react';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';

/** Keep an in-flight wallet operation mounted until its result is known. */
export function useSettingsBusy(busy: boolean) {
  usePreventRemove(busy, () => {});
  useEffect(() => {
    if (busy) return feedbackNavigationGuard.acquire();
  }, [busy]);
}

/** Wait for the navigator to process a guard release before automatic navigation. */
export function useSettingsCanLeave(busy: boolean) {
  const { preventedRoutes } = usePreventRemoveContext();
  const route = useRoute();
  return !busy && !preventedRoutes[route.key]?.preventRemove;
}
