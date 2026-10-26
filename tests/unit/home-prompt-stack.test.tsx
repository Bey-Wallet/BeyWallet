import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HomePromptStack } from '~/features/home/components/HomePromptStack';
import { useSettingsStore } from '~/state/settingsStore';
import { useSupporterStore } from '~/state/supporterStore';

const mockPush = jest.fn();
const mockBackupDismiss = jest.fn();
const mockUsernameDismiss = jest.fn();
const mockSupporterDismiss = jest.fn();
let mockNip05: string | null = null;
let mockLoading = false;
let mockReducedMotion = true;
let mockFontScale = 1;
let mockPan: Record<string, (event?: any) => void>;
let mockGestureEnabled = true;
const mockTiming = jest.fn((value, _options, complete) => {
  complete?.(true);
  return value;
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('~/shared/hooks/useNip05Lookup', () => ({
  useNip05Lookup: () => ({ nip05: mockNip05, loading: mockLoading }),
}));
jest.mock('~/shared/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));
jest.mock('react-native', () => {
  const descriptors = Object.getOwnPropertyDescriptors(jest.requireActual('react-native'));
  descriptors.useWindowDimensions = {
    value: () => ({ width: 360, height: 800, scale: 1, fontScale: mockFontScale }),
    configurable: true,
  };
  return Object.defineProperties({}, descriptors);
});
jest.mock('tamagui', () => ({ Text: 'Text', View: 'View', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({
  X: 'X',
  AlertTriangle: 'AlertTriangle',
  AtSign: 'AtSign',
  HeartHandshake: 'HeartHandshake',
}));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'CardButton' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'DismissButton' }));
jest.mock('~/features/supporter/SupporterModal', () => ({ SupporterModal: 'SupporterModal' }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/state/supporterStore', () => ({
  useSupporterStore: require('zustand').create(() => ({})),
}));
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    cancelAnimation: jest.fn(),
    runOnJS: (fn: unknown) => fn,
    withSpring: (value: unknown) => value,
    withTiming: (...args: unknown[]) => (mockTiming as any)(...args),
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (value: number, input: number[], output: number[]) => {
      const progress = Math.max(0, Math.min(1, (value - input[0]) / (input.at(-1)! - input[0])));
      return output[0] + progress * (output.at(-1)! - output[0]);
    },
  };
});
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: 'GestureDetector',
  Gesture: {
    Pan: () => {
      const handlers: Record<string, (event?: unknown) => void> = {};
      mockPan = handlers;
      const gesture: Record<string, (...args: any[]) => any> = {};
      for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
        gesture[name] = (handler) => {
          handlers[name] = handler;
          return gesture;
        };
      }
      for (const name of ['activeOffsetX', 'failOffsetY']) gesture[name] = () => gesture;
      gesture.enabled = (enabled) => {
        mockGestureEnabled = enabled;
        return gesture;
      };
      return gesture;
    },
  },
}));

let tree: ReactTestRenderer;
const front = () =>
  tree.root.findAllByType('CardButton' as any).find((node) => !!node.props.testID)!;
const dismiss = () => tree.root.findByType('DismissButton' as any);
const modal = () => tree.root.findByType('SupporterModal' as any);
async function render() {
  await act(async () => {
    tree = create(<HomePromptStack />);
  });
}
async function swipe(translationX: number, velocityX = 0) {
  await act(async () => {
    const handlers = mockPan;
    handlers.onStart();
    handlers.onUpdate({ translationX });
    handlers.onEnd({ translationX, velocityX });
    handlers.onFinalize();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNip05 = null;
  mockLoading = false;
  mockReducedMotion = true;
  mockFontScale = 1;
  mockBackupDismiss.mockImplementation(async (timestamp) => {
    useSettingsStore.setState({ backupDismissedAt: timestamp });
  });
  mockUsernameDismiss.mockImplementation(async (timestamp) => {
    useSettingsStore.setState({ usernameClaimDismissedAt: timestamp });
  });
  mockSupporterDismiss.mockImplementation(() => {
    useSupporterStore.setState({ homeCardDismissed: true });
  });
  useSettingsStore.setState({
    seedBackedUp: false,
    backupDismissedAt: 0,
    usernameClaimDismissedAt: 0,
    setBackupDismissedAt: mockBackupDismiss,
    setUsernameClaimDismissedAt: mockUsernameDismiss,
  });
  useSupporterStore.setState({ homeCardDismissed: false, dismissHomeCard: mockSupporterDismiss });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('shows a compact foreground and a small next-card edge, without a header or counter', async () => {
  await render();
  expect(front().props.testID).toBe('home-prompt-backup');
  expect(front().props.minHeight).toBe(84);
  expect(front().props.items).toBe('flex-start');
  expect(
    front()
      .findAllByType('Text' as any)
      .map((node) => node.props.children),
  ).toEqual(['Secure your wallet', 'Back up your recovery phrase to protect your funds.']);
  const text = tree.root.findAllByType('Text' as any);
  expect(text.some((node) => node.props.children === 'For you')).toBe(false);
  expect(text.every((node) => [12, 14].includes(node.props.fontSize))).toBe(true);
  const stack = tree.root.findByProps({ testID: 'home-prompt-stack' });
  expect(StyleSheet.flatten(stack.props.style).paddingBottom).toBe(10);
  expect(stack.props.collapsable).toBe(false);
  expect(front().props.width).toBe('100%');
  const layers = tree.root.findAllByType('AnimatedView' as any);
  const foreground = layers.find((node) => !node.props.accessibilityElementsHidden)!;
  expect(foreground.props.collapsable).toBe(false);
  expect(foreground.props.style[0]).toMatchObject({ position: 'relative', width: '100%' });
  expect(layers).toHaveLength(3); // Foreground, next card, and one invisible incoming layer.
  expect(layers.filter((node) => !node.props.accessibilityElementsHidden)).toHaveLength(1);
  expect(layers.filter((node) => node.props.style[1].opacity === 1)).toHaveLength(2);
  const next = layers.find(
    (node) => node.props.accessibilityElementsHidden && node.props.style[1].opacity === 1,
  )!;
  expect(next.props.style[1].transform).toContainEqual({ scale: 0.95 });
});

it('anchors X with a separate absolute wrapper instead of passing positioning to the shared button', async () => {
  await render();
  const wrapper = dismiss().parent!.props;
  expect(StyleSheet.flatten(wrapper.style) ?? wrapper).toMatchObject({
    position: 'absolute',
    top: 6,
    right: 6,
  });
  expect(dismiss().props.position).toBeUndefined();
  expect(dismiss().props.accessibilityLabel).toBe('Dismiss Secure your wallet');
  expect(dismiss().props.icon({ size: 22, color: '#FFFFFF' }).props).toMatchObject({
    size: 22,
    color: '$gray10',
  });
});

it('dismisses only the current card without navigating or hiding the remaining cards', async () => {
  await render();
  await act(async () => dismiss().props.onPress());
  expect(mockBackupDismiss).toHaveBeenCalledWith(expect.any(Number));
  expect(mockUsernameDismiss).not.toHaveBeenCalled();
  expect(mockSupporterDismiss).not.toHaveBeenCalled();
  expect(front().props.testID).toBe('home-prompt-username');
  await act(async () => dismiss().props.onPress());
  expect(mockUsernameDismiss).toHaveBeenCalledWith(expect.any(Number));
  expect(front().props.testID).toBe('home-prompt-supporter');
  expect(mockGestureEnabled).toBe(false);
  await act(async () => dismiss().props.onPress());
  expect(mockSupporterDismiss).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ testID: 'home-prompt-stack' })).toHaveLength(0);
  expect(mockPush).not.toHaveBeenCalled();
});

it('cycles left/right with wraparound, and never treats swiping as dismissal', async () => {
  await render();
  await swipe(-120);
  expect(front().props.testID).toBe('home-prompt-username');
  await swipe(-120);
  expect(front().props.testID).toBe('home-prompt-supporter');
  await swipe(-120);
  expect(front().props.testID).toBe('home-prompt-backup');
  await swipe(120);
  expect(front().props.testID).toBe('home-prompt-supporter');
  expect(mockBackupDismiss).not.toHaveBeenCalled();
  expect(mockUsernameDismiss).not.toHaveBeenCalled();
  expect(mockSupporterDismiss).not.toHaveBeenCalled();
  expect(mockTiming).not.toHaveBeenCalled(); // Reduced motion still permits navigation.
});

it('returns a short pan, commits a fast flick, and provides screen-reader next/previous actions', async () => {
  mockReducedMotion = false;
  await render();
  await swipe(-20);
  expect(front().props.testID).toBe('home-prompt-backup');
  await swipe(-20, -700);
  expect(front().props.testID).toBe('home-prompt-username');
  expect(mockTiming).toHaveBeenCalled();
  await act(async () =>
    front().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }),
  );
  expect(front().props.testID).toBe('home-prompt-supporter');
  await act(async () =>
    front().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }),
  );
  expect(front().props.testID).toBe('home-prompt-username');
});

it('does not navigate or dismiss while a pan is active', async () => {
  await render();
  await act(async () => {
    mockPan.onStart();
    mockPan.onUpdate({ translationX: -40 });
    front().props.onPress();
    void dismiss().props.onPress();
    mockPan.onFinalize();
  });
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockBackupDismiss).not.toHaveBeenCalled();
});

it('preserves backup snoozing and permanent username/supporter dismissal', async () => {
  useSettingsStore.setState({ backupDismissedAt: Date.now(), usernameClaimDismissedAt: 1 });
  useSupporterStore.setState({ homeCardDismissed: true });
  await render();
  expect(tree.root.findAllByProps({ testID: 'home-prompt-stack' })).toHaveLength(0);
  await act(async () =>
    useSettingsStore.setState({ backupDismissedAt: Date.now() - 8 * 86400000 }),
  );
  expect(front().props.testID).toBe('home-prompt-backup');
  await act(async () => useSettingsStore.setState({ seedBackedUp: true }));
  expect(tree.root.findAllByProps({ testID: 'home-prompt-stack' })).toHaveLength(0);
});

it.each([true, false])(
  'hides the username prompt when lookup is loading=%s or already claimed',
  async (loading) => {
    mockLoading = loading;
    mockNip05 = loading ? null : 'alice@bey.cash';
    useSettingsStore.setState({ seedBackedUp: true });
    await render();
    expect(front().props.testID).toBe('home-prompt-supporter');
    expect(mockGestureEnabled).toBe(false);
  },
);

it('keeps backup and username navigation at their existing destinations', async () => {
  await render();
  await act(async () => front().props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith('/(modals)/backup-seed');
  await swipe(-120);
  await act(async () => front().props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith('/(modals)/nostr-username');
});

it('opens the existing supporter modal once and freezes its motion setting until closed', async () => {
  mockReducedMotion = false;
  useSettingsStore.setState({ seedBackedUp: true, usernameClaimDismissedAt: 1 });
  await render();
  const instance = modal();
  await act(async () => {
    front().props.onPress();
    front().props.onPress();
  });
  expect(modal()).toBe(instance);
  expect(modal().props).toMatchObject({ visible: true, animationType: 'slide' });
  mockReducedMotion = true;
  await act(async () => tree.update(<HomePromptStack />));
  expect(modal().props.animationType).toBe('slide');
  await act(async () => modal().props.onClose());
  await act(async () => front().props.onPress());
  expect(modal().props).toMatchObject({ visible: true, animationType: 'none' });
  await act(async () => modal().props.onDoNotShowAgain());
  expect(modal().props.visible).toBe(false);
  expect(mockSupporterDismiss).toHaveBeenCalledTimes(1);
});

it('allows the compact card to grow with the accessibility font scale', async () => {
  mockFontScale = 2;
  await render();
  expect(front().props.minHeight).toBe(168);
  expect(
    front().props.children[1].props.children.every((node: any) => !node.props.numberOfLines),
  ).toBe(true);
});
