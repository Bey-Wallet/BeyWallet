import { buiBaseColors } from '~/shared/ui/BUI/palettes';
import { buiColors, getBUITheme, createBUITamaguiTheme } from '~/shared/ui/BUI/theme';

const expectedPalettes = {
  light: {
    buttons: {
      Primary: ['#007AFF', '#3D9AFF', '#1F8AFF', '#FFFFFF'],
      Secondary: ['#D3D4DB', '#D8D9E0', '#C9CAD1', '#000000'],
      Tertiary: ['#D3D4DB'],
    },
  },
  dark: {
    buttons: {
      Primary: ['#3C95FA', '#387BC7', '#55A2FA', '#FFFFFF'],
      Secondary: ['#17171A', '#0E0E0F', '#202024', '#FFFFFF'],
      Tertiary: ['#222224'],
    },
  },
};

it('keeps source colors outside the approved brand and light-surface overrides', () => {
  const brand = [
    'primary',
    'primaryDisabled',
    'primaryPressed',
    'primaryForeground',
    'fieldActiveBorder',
    'tabActive',
  ];
  for (const appearance of ['light', 'dark'] as const) {
    const allowed = new Set([
      ...brand,
      ...(appearance === 'light' ? ['canvas', 'surface', 'alternateSurface'] : []),
    ]);
    for (const key of Object.keys(
      buiBaseColors[appearance],
    ) as (keyof typeof buiBaseColors.light)[]) {
      if (!allowed.has(key))
        expect(buiColors[appearance][key]).toBe(buiBaseColors[appearance][key]);
    }
  }
  expect(buiColors.light.canvas).toBe('#FFFFFF');
  expect(buiColors.light.surface).toBe('#EFEEF3');
});

it.each(['light', 'dark'] as const)('uses blue primary and matching focus in %s', (appearance) => {
  const c = getBUITheme(appearance);
  const theme = createBUITamaguiTheme(appearance);
  expect([c.buttons.Primary[0], c.buttons.Primary[3]]).toEqual(
    appearance === 'light' ? ['#007AFF', '#FFFFFF'] : ['#3C95FA', '#FFFFFF'],
  );
  expect(c.buttons.Primary[1]).toBe(c.primaryDisabled);
  expect(c.buttons.Primary[2]).toBe(c.primaryPressed);
  expect(theme.accentColor).toBe(c.primary);
  expect(theme.onAccent).toBe(c.primaryForeground);
  expect(theme.borderColorFocus).toBe(c.primary);
  expect(theme.tabActive).toBe(c.primary);
});

it('feeds the same palette into semantic preview controls', () => {
  const theme = createBUITamaguiTheme('dark');
  expect(theme.gray10).toBe(buiBaseColors.dark.secondaryText);
  expect(theme.buttonDefaultSecondaryPress).toBe(expectedPalettes.dark.buttons.Secondary[2]);
  expect(theme.fieldBackground).toBe(buiBaseColors.dark.field);
});

it.each(['light', 'dark'] as const)(
  'defaults to source blue and preserves button hierarchy in %s',
  (appearance) => {
    expect(getBUITheme(appearance).buttons.Primary).toEqual(
      expectedPalettes[appearance].buttons.Primary,
    );
    const c = getBUITheme(appearance);
    const native = createBUITamaguiTheme(appearance);
    expect(native.accentColor).toBe(c.primary);
    expect(native.onAccent).toBe(c.primaryForeground);
    expect(native.borderColorFocus).toBe(c.primary);
    expect(c.buttons.Secondary).toEqual(expectedPalettes[appearance].buttons.Secondary);
    expect(native.buttonDefaultSecondary).toBe(c.secondaryButton[0]);
    expect(native.buttonDefaultSecondaryText).toBe(c.buttons.Secondary[3]);
    if (appearance === 'light') {
      expect(c.secondaryButton).toEqual(['#E7E6EB', '#EFEEF3', '#DDDCE2', '#000000']);
    } else {
      expect(c.secondaryButton).toEqual(expectedPalettes.dark.buttons.Secondary);
    }
    expect(c.buttons.Tertiary[0]).toBe('transparent');
    expect(c.buttons.Tertiary[3]).toBe(c.primary);
    expect(c.buttons.Tertiary[2]).not.toBe('transparent');
    expect(c.switchInactive).toBe(expectedPalettes[appearance].buttons.Tertiary[0]);
  },
);
