import { useEffect, useRef } from 'react';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';

/** Keep the finishing cover visible until the mounted navigator reaches recovery. */
export function useRecoveryHandoff() {
  const needsReview = useRecoverySessionStore((s) => !!s.session?.needsReview);
  const state = useRootNavigationState();
  const pathname = usePathname();
  const router = useRouter();
  const opened = useRef(false);
  const atRecovery = pathname.endsWith('/recover-funds');
  useEffect(() => {
    if (!needsReview || opened.current || !state?.key) return;
    if (atRecovery) {
      opened.current = true;
      return;
    }
    router.replace('/(tabs)/settings/recover-funds');
  }, [needsReview, state?.key, atRecovery, router]);
  return needsReview && !opened.current && !atRecovery;
}
