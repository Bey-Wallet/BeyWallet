import { createContext, useContext, useEffect, useRef } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { feedbackCoordinator, type FeedbackEvent } from '~/services/feedback/feedbackCoordinator';
import * as Haptics from 'expo-haptics';
import { feedbackCatalog } from '~/services/feedback/feedbackCatalog';

function ownerHaptic(event: FeedbackEvent) {
  const severity = feedbackCatalog[event.kind].severity;
  void Promise.resolve(
    Haptics.notificationAsync(
      severity === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ),
  ).catch(() => {});
}

/** Release on blur/unmount. IDs are operation/quote/request IDs, never payment inputs. */
const standaloneContext = createContext<undefined>(undefined);
export function useFeedbackOwner(
  id: string | readonly string[] | null | undefined,
  onOutcome?: (event: FeedbackEvent) => void,
) {
  const navigation = useContext(NavigationContext ?? standaloneContext);
  const callback = useRef(onOutcome);
  callback.current = onOutcome;
  const ids = typeof id === 'string' ? [id] : (id ?? []);
  const ownerKey = JSON.stringify(ids);
  useEffect(() => {
    if (!ids.length) return;
    let release: (() => void) | undefined;
    const focus = () => {
      release?.();
      const owners = ids.map((entityId) =>
        feedbackCoordinator.claim(entityId, (event) => (callback.current ?? ownerHaptic)(event)),
      );
      release = () => owners.forEach((owner) => owner());
    };
    const blur = () => {
      release?.();
      release = undefined;
    };
    if (navigation?.isFocused() ?? true) focus();
    const stopFocus = navigation?.addListener('focus', focus);
    const stopBlur = navigation?.addListener('blur', blur);
    return () => {
      blur();
      stopFocus?.();
      stopBlur?.();
    };
  }, [ownerKey, navigation]);
}

/** Global sheets are outside a screen navigator; their visible lifetime is explicit. */
export function useSheetFeedbackOwner(id: string | null, visible: boolean) {
  useEffect(() => {
    if (id && visible) return feedbackCoordinator.claim(id, ownerHaptic);
  }, [id, visible]);
}
