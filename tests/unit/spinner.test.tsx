import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Spinner } from '~/shared/ui/Spinner';
import { AppButton } from '~/shared/ui/AppButton';
import { cancelAnimation, withRepeat } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

jest.mock('tamagui', () => ({
  Button: 'Button',
  Text: 'Text',
  XStack: 'XStack',
  YStack: 'YStack',
  useTheme: () => ({}),
  variableToString: String,
}));
jest.mock('@tamagui/lucide-icons', () => ({ Loader: 'Loader' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const rotation = { value: 0 };
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    useSharedValue: () => rotation,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withRepeat: jest.fn(() => 360),
    withTiming: jest.fn(() => 360),
    cancelAnimation: jest.fn(),
    Easing: { linear: jest.fn(), bezier: jest.fn(() => (value: number) => value) },
  };
});

it('cancels rotation when reduced motion is enabled and on unmount', async () => {
  jest.clearAllMocks();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Spinner />);
  });
  expect(withRepeat).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Spinner reduceMotion />));
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
  expect(
    StyleSheet.flatten(tree.root.findByType('AnimatedView' as any).props.style).transform,
  ).toEqual([{ rotate: '0deg' }]);
  await act(async () => tree.update(<Spinner reduceMotion={false} />));
  expect(withRepeat).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
  expect(cancelAnimation).toHaveBeenCalledTimes(2);
});

it('cancels the button spinner when controlled loading ends', async () => {
  jest.clearAllMocks();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppButton loading>Example</AppButton>);
  });
  expect(withRepeat).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<AppButton>Example</AppButton>));
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
});
