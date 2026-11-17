import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  hapticForWalletFeedback,
  hapticService,
  playNativeHaptic,
} from '~/services/platform/hapticService';
import type { FeedbackEvent } from '~/services/feedback/feedbackCoordinator';

jest.mock('expo-haptics', () => ({
  AndroidHaptics: {
    Segment_Tick: 'tick',
    Keyboard_Tap: 'key',
    Confirm: 'confirm',
    Reject: 'reject',
  },
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  performAndroidHapticsAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
}));
const originalOS = Platform.OS;
let disconnect: (() => void) | undefined;
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  disconnect?.();
  Object.defineProperty(Platform, 'OS', { value: originalOS });
});
const os = (value: string) => Object.defineProperty(Platform, 'OS', { value });
const event: FeedbackEvent = {
  walletId: 'wallet',
  entity: { type: 'receipt', id: 'receipt' },
  kind: 'received',
  state: 'completed',
  origin: 'live',
};
it('uses Android UI effects without impact/notification waveform fallbacks', async () => {
  os('android');
  for (const intent of [
    'selection',
    'keypad',
    'acknowledge',
    'completion',
    'review',
    'reject',
  ] as const)
    await playNativeHaptic(intent);
  expect(jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls.flat()).toEqual([
    'tick',
    'key',
    'tick',
    'confirm',
    'reject',
    'reject',
  ]);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
it('uses subtle iOS selections and distinct acknowledgments/outcomes', async () => {
  os('ios');
  for (const intent of [
    'selection',
    'keypad',
    'acknowledge',
    'completion',
    'review',
    'reject',
  ] as const)
    await playNativeHaptic(intent);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  expect(jest.mocked(Haptics.notificationAsync).mock.calls.flat()).toEqual([
    'success',
    'warning',
    'error',
  ]);
});
it('does nothing on web', () => {
  os('web');
  playNativeHaptic('completion');
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
it('only announces live completed funds, with one aggregate review taking precedence', () => {
  os('ios');
  disconnect = hapticService.connect(() => ({
    ready: true,
    enabled: true,
    foreground: true,
    unlocked: true,
    reducedMotion: false,
  }));
  for (const state of ['pending', 'prepared'] as const)
    hapticForWalletFeedback([{ ...event, state }]);
  hapticForWalletFeedback([{ ...event, origin: 'catch-up' }]);
  hapticForWalletFeedback([{ ...event, kind: 'message' }]);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  hapticForWalletFeedback([event, event]);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  hapticForWalletFeedback([event, { ...event, kind: 'review', state: 'review' }]);
  expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('warning');
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
});
it('invalidates captured eligibility when preferences/auth/lifecycle change', () => {
  const state = {
    ready: true,
    enabled: true,
    foreground: true,
    unlocked: true,
    reducedMotion: false,
  };
  disconnect = hapticService.connect(() => state);
  const before = hapticService.epoch();
  hapticService.invalidate();
  expect(hapticService.epoch()).not.toEqual(before);
  state.enabled = false;
  expect(hapticService.epoch()).toBeUndefined();
});
