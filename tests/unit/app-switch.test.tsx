import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import { AppSwitch } from '~/shared/ui/AppSwitch';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  useAnimatedStyle: (callback: () => unknown) => callback(),
  interpolateColor: (value: number, _: number[], colors: string[]) => colors[value ? 1 : 0],
  withTiming: (value: number) => value,
  Easing: { quad: jest.fn(), inOut: jest.fn() },
}));
const NativePressable = (Pressable as unknown as { type?: typeof Pressable }).type ?? Pressable;

it('isolates row taps, waits for controlled approval, and blocks disabled switches', async () => {
  const onCheckedChange = jest.fn();
  const stopPropagation = jest.fn();
  let tree!: ReactTestRenderer;
  const render = (checked: boolean, disabled = false) => (
    <TamaguiProvider config={config} defaultTheme="light">
      <AppSwitch
        accessibilityLabel="App Lock"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        variant="branded"
        emphasis="secondary"
      />
    </TamaguiProvider>
  );
  await act(async () => {
    tree = create(render(false));
  });
  const control = () => tree.root.findByType(NativePressable);
  expect(control().props.accessibilityRole).toBe('switch');
  await act(async () => control().props.onPress({ stopPropagation }));
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(onCheckedChange).toHaveBeenCalledTimes(1);
  expect(onCheckedChange).toHaveBeenLastCalledWith(true);
  expect(control().props.accessibilityState.checked).toBe(false);
  await act(async () => tree.update(render(true)));
  expect(control().props.accessibilityState.checked).toBe(true);
  await act(async () => control().props.onPress({ stopPropagation }));
  expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  await act(async () => tree.update(render(true, true)));
  await act(async () => control().props.onPress({ stopPropagation }));
  expect(onCheckedChange).toHaveBeenCalledTimes(2);
  expect(control().props.accessibilityState.disabled).toBe(true);
  await act(async () => tree.unmount());
});
