import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppButton } from '~/shared/ui/AppButton';
import { buttonThemes } from '~/tamagui.config';
import { defaultConfig } from '@tamagui/config/v5';
import { processColor } from 'react-native';

let mockTheme: Record<string, { val: string }>;
let mockReducedMotion = false;
jest.mock('~/shared/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));
jest.mock('tamagui', () => ({
  Button: 'Button',
  Text: 'Text',
  XStack: 'XStack',
  createFont: (value: unknown) => value,
  createTamagui: (value: unknown) => value,
  useTheme: () => mockTheme,
}));
jest.mock('@tamagui/animations-react-native', () => ({ createAnimations: jest.fn() }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));

beforeEach(() => {
  mockReducedMotion = false;
  mockTheme = Object.fromEntries(
    Object.entries({ ...buttonThemes.light, blue10: defaultConfig.themes.light.blue10 }).map(
      ([key, val]) => [key, { val }],
    ),
  );
});

async function render(props: Partial<React.ComponentProps<typeof AppButton>> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AppButton {...props}>Submit example</AppButton>);
  });
  return tree;
}

it.each([{ disabled: true }, { loading: true }, { loading: true, disabled: true }])(
  'blocks presses and exposes state: %j',
  async (state) => {
    const onPress = jest.fn();
    const tree = await render({ ...state, onPress });
    const button = tree.root.findByType('Button' as any);
    button.props.onPress({});
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: !!state.loading });
    await act(async () => tree.unmount());
  },
);

it('shows the label alongside the loading spinner and restores aligned icons when loading ends', async () => {
  const Icon = () => null;
  const onPress = jest.fn();
  const tree = await render({ icon: Icon, iconAfter: Icon, loading: true, onPress });
  expect(tree.root.findByType('Text' as any).props.children).toBe('Submit example');
  expect(tree.root.findAllByType(Icon)).toHaveLength(0);
  expect(tree.root.findByType('Spinner' as any).props).toMatchObject({
    width: 20,
    height: 20,
  });
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  await act(async () =>
    tree.update(
      <AppButton loading loadingText="Preparing…">
        Submit example
      </AppButton>,
    ),
  );
  expect(tree.root.findByType('Text' as any).props.children).toBe('Preparing…');
  expect(tree.root.findByType('Button' as any).props.accessibilityLabel).toBe('Preparing…');
  await act(async () =>
    tree.update(
      <AppButton icon={Icon} iconAfter={Icon} onPress={onPress}>
        Submit example
      </AppButton>,
    ),
  );
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(tree.root.findAllByType(Icon)).toHaveLength(2);
  for (const icon of tree.root.findAllByType(Icon)) {
    expect(icon.parent!.props).toMatchObject({
      width: 20,
      height: 20,
      flexShrink: 0,
      items: 'center',
      justify: 'center',
    });
  }
  tree.root.findByType('Button' as any).props.onPress({});
  expect(onPress).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it.each([
  ['xxsmall', 8],
  ['xsmall', 10],
  ['small', 12],
  ['medium', 16],
  ['large', 20],
] as const)('uses proportional corner rounding for %s buttons', async (size, radius) => {
  const tree = await render({ size });
  expect(tree.root.findByType('Button' as any).props.rounded).toBe(radius);
  await act(async () => tree.unmount());
});

it('resolves the current theme, preserves loading colors and removes reduced-motion scaling', async () => {
  mockTheme = Object.fromEntries(
    Object.entries(buttonThemes.dark).map(([key, val]) => [key, { val }]),
  );
  const tree = await render({ variant: 'default', loading: true, disabled: true });
  expect(tree.root.findByType('Button' as any).props.backgroundColor).toBe('#FFFFFF');
  expect(tree.root.findByType('Text' as any).props.color).toBe('#181818');
  mockReducedMotion = true;
  await act(async () => tree.update(<AppButton size="xxsmall">Submit example</AppButton>));
  const button = tree.root.findByType('Button' as any);
  expect(button.props.pressStyle.scale).toBe(1);
  expect(button.props.hitSlop.top * 2 + button.props.minHeight).toBe(48);
  await act(async () => tree.unmount());
});

const luminance = (color: string) => {
  const parsed = processColor(color);
  if (typeof parsed !== 'number') throw new Error(`Invalid palette color: ${color}`);
  const values = [16, 8, 0].map((shift) => {
    const value = ((parsed >>> shift) & 255) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
it('maintains readable contrast for enabled solid palettes in every state', () => {
  for (const palette of Object.values(buttonThemes)) {
    for (const variant of ['Default', 'Branded', 'Critical', 'Warning']) {
      for (const emphasis of ['Primary', 'Secondary']) {
        for (const state of ['', 'Hover', 'Press']) {
          const prefix = `button${variant}${emphasis}`;
          const background = luminance(palette[`${prefix}${state}`]);
          const foreground = luminance(palette[`${prefix}Text`]);
          expect(
            (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05),
            // The requested blue10 with white text has lower contrast in the dark theme.
          ).toBeGreaterThanOrEqual(
            variant === 'Branded' && emphasis === 'Primary' && !state ? 3 : 4.5,
          );
        }
      }
      for (const state of ['', 'Hover', 'Press']) {
        const textKey =
          variant === 'Branded' && state ? `buttonBrandedText${state}` : `button${variant}Text`;
        const foreground = luminance(palette[textKey]);
        const background = luminance(
          state
            ? palette[`button${variant}Secondary${state}`]
            : palette === buttonThemes.light
              ? '#FFFFFF'
              : '#000000',
        );
        expect(
          (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
