import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
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

async function render(
  props: Partial<Extract<React.ComponentProps<typeof AppButton>, { iconOnly?: false }>> = {},
) {
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

it('centers only the loader, preserves label geometry, and restores icons after loading', async () => {
  const Icon = () => null;
  const onPress = jest.fn();
  const tree = await render({ icon: Icon, iconAfter: Icon, loading: true, onPress });
  expect(tree.root.findByType('Text' as any).props.children).toBe('Submit example');
  expect(tree.root.findByType('Text' as any).parent!.props).toMatchObject({
    opacity: 0,
    'aria-hidden': true,
    accessibilityElementsHidden: true,
  });
  expect(tree.root.findAllByType(Icon)).toHaveLength(0);
  expect(tree.root.findByType('Spinner' as any).props).toMatchObject({
    width: 20,
    height: 20,
  });
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findByType('Spinner' as any).parent!.props).toMatchObject({
    position: 'absolute',
    inset: 0,
    items: 'center',
    justify: 'center',
  });
  await act(async () =>
    tree.update(
      <AppButton loading loadingText="Preparing…">
        Submit example
      </AppButton>,
    ),
  );
  expect(tree.root.findByType('Text' as any).props.children).toBe('Submit example');
  expect(tree.root.findByType('Button' as any).props.accessibilityLabel).toBe('Preparing…');
  await act(async () =>
    tree.update(
      <AppButton icon={Icon} iconAfter={Icon} onPress={onPress}>
        Submit example
      </AppButton>,
    ),
  );
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(tree.root.findByType('Text' as any).parent!.props.opacity).toBe(1);
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
  ['xxsmall', '$3'],
  ['xsmall', '$4'],
  ['small', '$5'],
  ['medium', '$6'],
  ['large', '$6'],
] as const)('uses proportional corner rounding for %s buttons', async (size, radius) => {
  const tree = await render({ size });
  expect(tree.root.findByType('Button' as any).props.rounded).toBe(radius);
  await act(async () => tree.unmount());
});

it('centers an icon-only loading spinner and keeps its accessible name', async () => {
  const Icon = () => null;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AppButton
        iconOnly
        icon={Icon}
        shape="circular"
        size="small"
        accessibilityLabel="Scan QR code"
        loading
      />,
    );
  });
  const button = tree.root.findByType('Button' as any);
  expect(button.props).toMatchObject({
    width: 40,
    minHeight: 40,
    rounded: 20,
    accessibilityLabel: 'Scan QR code',
  });
  expect(tree.root.findAllByType('Text' as any)).toHaveLength(0);
  expect(tree.root.findAllByType(Icon)).toHaveLength(0);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  await act(async () => tree.unmount());
});

it.each([
  ['xxsmall', 32, 20],
  ['xsmall', 36, 24],
  ['small', 40, 28],
  ['medium', 48, 32],
  ['large', 56, 36],
] as const)(
  'uses compact geometry and a 48 point touch target for %s icon actions',
  async (size, dimension, iconSize) => {
    const Icon = (_props: { size?: number }) => null;
    const ref = React.createRef<React.ComponentRef<typeof AppIconButton>>();
    const onPress = jest.fn();
    let tree!: ReactTestRenderer;
    mockReducedMotion = true;
    await act(async () => {
      tree = create(
        <AppIconButton
          ref={ref}
          icon={Icon}
          size={size}
          accessibilityLabel="Scan"
          onPress={onPress}
        />,
        {
          createNodeMock: (element) => (element.type === 'Button' ? { marker: 'button' } : null),
        },
      );
    });
    const button = tree.root.findByType('Button' as any);
    expect(ref.current).toEqual({ marker: 'button' });
    expect(button.props).toMatchObject({ width: dimension, minHeight: dimension, px: 4, py: 4 });
    expect(button.props.hitSlop.top * 2 + dimension).toBeGreaterThanOrEqual(48);
    expect(tree.root.findByType(Icon).props.size).toBe(iconSize);
    expect(tree.root.findAllByType('Text' as any)).toHaveLength(0);
    await act(async () =>
      tree.update(
        <AppIconButton
          icon={Icon}
          size={size}
          accessibilityLabel="Scan"
          onPress={onPress}
          loading
        />,
      ),
    );
    tree.root.findByType('Button' as any).props.onPress({});
    expect(onPress).not.toHaveBeenCalled();
    expect(tree.root.findByType('Spinner' as any).props).toMatchObject({
      size: iconSize,
      reduceMotion: true,
    });
    await act(async () => tree.unmount());
  },
);

it('normalizes element icon geometry without losing stroke details and honors layout width', async () => {
  const Icon = (_props: { size?: number; color?: string; strokeWidth?: number }) => null;
  const tree = await render({ width: 220, icon: <Icon size={32} color="red" strokeWidth={3} /> });
  expect(tree.root.findByType(Icon).props).toMatchObject({
    size: 20,
    color: '#FFFFFF',
    strokeWidth: 3,
  });
  expect(tree.root.findByType('Button' as any).props.width).toBe(220);
  await act(async () =>
    tree.update(
      <AppButton fullWidth width={220}>
        Submit example
      </AppButton>,
    ),
  );
  expect(tree.root.findByType('Button' as any).props.width).toBe('100%');
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
