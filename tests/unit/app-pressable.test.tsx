import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, StyleSheet } from 'react-native';
import { TamaguiProvider, Text } from 'tamagui';
import { config } from '~/tamagui.config';
import { AppPressable } from '~/shared/ui/AppPressable';

let mockReducedMotion = false;
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
const NativePressable = (Pressable as unknown as { type?: typeof Pressable }).type ?? Pressable;

it('preserves selection and expansion and blocks disabled presses and long presses', async () => {
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  let tree!: ReactTestRenderer;
  const render = (disabled: boolean) => (
    <TamaguiProvider config={config} defaultTheme="light">
      <AppPressable
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel="Choose mint"
        accessibilityState={{ selected: true, expanded: true }}
      >
        <Text>Mint selector</Text>
      </AppPressable>
    </TamaguiProvider>
  );
  await act(async () => {
    tree = create(render(true));
  });
  const getPressable = () => tree.root.findByType(NativePressable);
  expect(getPressable().props.accessibilityState).toMatchObject({
    selected: true,
    expanded: true,
    disabled: true,
  });
  getPressable().props.onPress({});
  getPressable().props.onLongPress({});
  expect(onPress).not.toHaveBeenCalled();
  expect(onLongPress).not.toHaveBeenCalled();
  await act(async () => tree.update(render(false)));
  getPressable().props.onPress({});
  getPressable().props.onLongPress({});
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(onLongPress).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('passes through nested action propagation and forwards the native ref', async () => {
  const onPress = jest.fn((event) => event.stopPropagation());
  const stopPropagation = jest.fn();
  const ref = React.createRef<React.ElementRef<typeof AppPressable>>();
  const host = { focus: jest.fn() };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TamaguiProvider config={config} defaultTheme="dark">
        <AppPressable ref={ref} onPress={onPress}>
          <Text>Edit nickname</Text>
        </AppPressable>
      </TamaguiProvider>,
      { createNodeMock: () => host },
    );
  });
  tree.root.findByType(NativePressable).props.onPress({ stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(ref.current !== null).toBe(true);
  await act(async () => tree.unmount());
  expect(ref.current).toBeNull();
});

it('resolves layout and focus colors and removes pressed scaling under reduced motion', async () => {
  mockReducedMotion = true;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TamaguiProvider config={config} defaultTheme="dark">
        <AppPressable minHeight={32} px={12} style={{ maxWidth: 240 }} pressStyle={{ scale: 1.5 }}>
          <Text>Filter</Text>
        </AppPressable>
      </TamaguiProvider>,
    );
  });
  const getPressable = () => tree.root.findByType(NativePressable);
  const styles = () => StyleSheet.flatten(getPressable().props.style);
  expect(styles()).toMatchObject({
    minHeight: 32,
    maxWidth: 240,
    paddingLeft: 12,
    paddingRight: 12,
  });
  expect(getPressable().props.hitSlop).toBe(8);
  await act(async () => getPressable().props.onPressIn({}));
  expect(styles().transform).toContainEqual({ scale: 1 });
  await act(async () => getPressable().props.onFocus({ currentTarget: {} }));
  expect(styles()).toMatchObject({
    outlineWidth: 2,
    outlineOffset: 2,
    outlineColor: config.themes.dark.blue10.val,
  });
  await act(async () => tree.unmount());
  mockReducedMotion = false;
});
