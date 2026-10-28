import { usePreventRemove } from '@react-navigation/native';
import { useEffect } from 'react';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';

/** Keep an in-flight wallet operation mounted until its result is known. */
export function useSettingsBusy(busy: boolean) {
  usePreventRemove(busy, () => {});
  useEffect(() => {
    if (busy) return feedbackNavigationGuard.acquire();
  }, [busy]);
}
