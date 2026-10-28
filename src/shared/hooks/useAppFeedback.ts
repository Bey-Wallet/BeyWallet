import { interactionCopy } from '~/services/feedback/interactionCopy';
import { useEffect, useRef } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useToastController } from '@tamagui/toast';
import { usePathname, useRouter } from 'expo-router';
import { feedbackCoordinator, type FeedbackTarget } from '~/services/feedback/feedbackCoordinator';
import { feedbackCatalog } from '~/services/feedback/feedbackCatalog';
import { deliveryIdentifier } from '~/services/feedback/deliveryIdentifier';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';
import {
  isFeedbackTarget,
  NotificationResponseQueue,
} from '~/services/feedback/notificationNavigation';
import { notificationService } from '~/services/platform/notificationService';
import { FeedbackRepository } from '~/storage/sqlite/repositories/FeedbackRepository';
import { initService } from '~/services/wallet/initService';
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { usePeopleStore } from '~/state/peopleStore';

export function useAppFeedback() {
  const toast = useToastController();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const responses = useRef(new NotificationResponseQueue());
  const summaries = useRef(new Set<string>());
  useEffect(() => {
    const unlocked = () =>
      useSettingsStore.getState().initialized &&
      (!useSettingsStore.getState().biometricEnabled || useAuthStore.getState().isAuthenticated);
    const canNavigate = () =>
      !!feedbackCoordinator.wallet &&
      initService.isInitialized() &&
      useOnboardingStore.getState().isOnboarded &&
      unlocked() &&
      AppState.currentState === 'active' &&
      !recoveryCoordinator.paused &&
      !useAuthStore.getState().isLockDisabled &&
      !/\/(send|receive|mint|melt|swap|scanner)$/.test(currentPath.current) &&
      !feedbackNavigationGuard.blocked;
    const navigate = async (target: FeedbackTarget, deliveryId: string) => {
      if (!isFeedbackTarget(target)) return;
      const wallet = feedbackCoordinator.wallet;
      if (target.type === 'transaction') {
        const entry = await initService.getRepo().historyRepository.getHistoryEntryById(target.id);
        if (wallet !== feedbackCoordinator.wallet) return;
        if (!canNavigate()) {
          responses.current.defer(deliveryId);
          return;
        }
        if (entry) {
          router.push({ pathname: '/(modals)/txn-details', params: { id: target.id } });
          return;
        }
      } else if (target.type === 'conversation') {
        if (usePeopleStore.getState().people[target.id]) {
          router.push({ pathname: '/(modals)/conversation', params: { npub: target.id } });
          return;
        }
        router.push('/(tabs)/people');
      } else if (target.type === 'incoming') {
        const item = useNostrInboxStore.getState().items.find((item) => item.id === target.id);
        if (item && !['dismissed', 'claimed'].includes(item.status)) {
          DeviceEventEmitter.emit('nostr:openClaim', item);
          return;
        }
        router.push('/(modals)/nostr-activity');
      } else if (target.type === 'recovery') {
        router.push('/(tabs)/settings/recover-funds');
        return;
      } else {
        router.push('/(tabs)/history');
        return;
      }
      if (target.type === 'transaction') router.push('/(tabs)/history');
      toast.show(interactionCopy.thisItemIsNoLongerAvailable.title, {
        kind: interactionCopy.thisItemIsNoLongerAvailable.severity,
      });
    };
    const disconnect = feedbackCoordinator.connect({
      foreground: () => AppState.currentState === 'active',
      unlocked,
      toast: async (events) => {
        const event = events[0];
        const copy = feedbackCatalog[event.kind];
        const settings = useSettingsStore.getState();
        const title = events.length > 1 ? 'New wallet activity' : copy.title;
        // Foreground previews also respect hidden balances. No sender/message text.
        const message =
          !settings.hideBalance && event.details && events.length === 1
            ? `${event.details.amount.toLocaleString()} sat`
            : undefined;
        toast.show(title, {
          kind: copy.severity,
          message,
          customData: {
            kind: copy.severity,
            variant: 'action',
            actionLabel: 'View',
            onAction: () => {
              void deliveryIdentifier(event).then((id) => {
                if (events.length > 1) summaries.current.add(id);
                responses.current.enqueue(id);
              });
            },
          },
        });
        await Haptics.notificationAsync(
          copy.severity === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      },
      notification: (events) => notificationService.deliver(events),
    });
    void notificationService.initialize();
    let mounted = true;
    let navigating = false;
    let wallet: string | undefined;
    const capture = (response: Notifications.NotificationResponse | null) => {
      if (mounted && response) {
        const data = response.notification.request.content.data;
        if (data?.summary === true && typeof data.feedbackId === 'string')
          summaries.current.add(data.feedbackId);
        responses.current.enqueue(data?.feedbackId);
      }
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const listener = Notifications.addNotificationResponseReceivedListener(capture);
    void Notifications.getLastNotificationResponseAsync()
      .then(capture)
      .catch(() => {});
    // Queue until initialization/authentication and protected operations have settled.
    const timer = setInterval(() => {
      if (!mounted || navigating) return;
      const nextWallet = feedbackCoordinator.wallet;
      if (wallet && nextWallet !== wallet) {
        responses.current.clear();
        summaries.current.clear();
      }
      wallet = nextWallet;
      const id = responses.current.take(canNavigate());
      if (!id || !wallet) return;
      navigating = true;
      const boundWallet = wallet;
      void new FeedbackRepository(initService.getRepo().db)
        .target(wallet, id)
        .then(async (target) => {
          if (!mounted || boundWallet !== feedbackCoordinator.wallet) return;
          if (!canNavigate()) {
            responses.current.defer(id);
            return;
          }
          if (target && isFeedbackTarget(target))
            await navigate(summaries.current.has(id) ? { type: 'history' } : target, id);
        })
        .catch(() => {})
        .finally(() => {
          navigating = false;
        });
    }, 500);
    const hideSensitive = () => {
      if (!unlocked() || useSettingsStore.getState().hideBalance) toast.hide();
    };
    const auth = useAuthStore.subscribe(hideSensitive);
    const preferences = useSettingsStore.subscribe(hideSensitive);
    return () => {
      mounted = false;
      clearInterval(timer);
      listener.remove();
      disconnect();
      auth();
      preferences();
    };
  }, [router, toast]);
}
