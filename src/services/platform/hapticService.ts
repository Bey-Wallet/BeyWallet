import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { HapticPolicy, type HapticIntent, type HapticState } from '../feedback/hapticPolicy';
import type { FeedbackEvent } from '../feedback/feedbackCoordinator';

export function playNativeHaptic(intent: HapticIntent) {
  if (Platform.OS === 'android') {
    const effects = {
      selection: Haptics.AndroidHaptics.Segment_Tick,
      keypad: Haptics.AndroidHaptics.Keyboard_Tap,
      acknowledge: Haptics.AndroidHaptics.Segment_Tick,
      completion: Haptics.AndroidHaptics.Confirm,
      review: Haptics.AndroidHaptics.Reject,
      reject: Haptics.AndroidHaptics.Reject,
    };
    return Haptics.performAndroidHapticsAsync(effects[intent]);
  }
  if (Platform.OS !== 'ios') return;
  if (intent === 'selection' || intent === 'keypad') return Haptics.selectionAsync();
  if (intent === 'acknowledge') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  return Haptics.notificationAsync(
    intent === 'completion'
      ? Haptics.NotificationFeedbackType.Success
      : intent === 'review'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error,
  );
}

let readState: (() => HapticState) | undefined;
let epoch = 0;
const policy = new HapticPolicy(
  () =>
    readState?.() ?? {
      ready: false,
      enabled: false,
      foreground: false,
      unlocked: false,
      reducedMotion: true,
    },
  playNativeHaptic,
);

/** The root supplies live state readers; this leaf never imports wallet/auth stores. */
export const hapticService = {
  connect(reader: () => HapticState) {
    epoch++;
    readState = reader;
    return () => {
      if (readState === reader) {
        readState = undefined;
        epoch++;
      }
    };
  },
  invalidate: () => {
    epoch++;
  },
  epoch: () => {
    const state = readState?.();
    return state?.ready && state.enabled && state.foreground && state.unlocked ? epoch : undefined;
  },
  selection: () => policy.emit('selection'),
  keypad: () => policy.emit('keypad'),
  acknowledge: () => policy.emit('acknowledge'),
  completion: () => policy.emit('completion'),
  review: () => policy.emit('review'),
  reject: () => policy.emit('reject'),
};

/** Only called from the coordinator's durable, live delivery paths. */
export function hapticForWalletFeedback(events: readonly FeedbackEvent[]) {
  if (events.some((event) => event.origin === 'live' && event.state === 'review')) {
    hapticService.review();
  } else if (
    events.some(
      (event) =>
        event.origin === 'live' &&
        event.state === 'completed' &&
        ['received', 'sent', 'transfer'].includes(event.kind),
    )
  ) {
    hapticService.completion();
  }
}
