import { createAppColorTheme } from '~/shared/theme/appearance';
import { buttonThemes } from '~/shared/theme/buttons';
import { defaultConfig } from '@tamagui/config/v5';
import { buiBaseColors } from '~/shared/ui/BUI/palettes';
import { buiColors, getBUITheme, createBUITamaguiTheme } from '~/shared/ui/BUI/theme';

const expectedPalettes = {
  light: {
    buttons: {
      Primary: ['#000000', defaultConfig.themes.light.gray3, '#2F2F33', '#FFFFFF'],
      Secondary: ['#D3D4DB', '#D8D9E0', '#C9CAD1', '#000000'],
      Tertiary: ['#D3D4DB'],
    },
  },
  dark: {
    buttons: {
      Primary: ['#FFFFFF', '#222224', '#D9D9D9', '#000000'],
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
      ...(appearance === 'light'
        ? ['canvas', 'surface', 'raised', 'pressed', 'field', 'alternateSurface']
        : []),
    ]);
    for (const key of Object.keys(
      buiBaseColors[appearance],
    ) as (keyof typeof buiBaseColors.light)[]) {
      if (!allowed.has(key))
        expect(buiColors[appearance][key]).toBe(buiBaseColors[appearance][key]);
    }
  }
  expect(buiColors.light.canvas).toBe('#FFFFFF');
  expect(buiColors.light.surface).toBe(defaultConfig.themes.light.gray2);
  const theme = createBUITamaguiTheme('light');
  expect(theme.gray3).toBe(defaultConfig.themes.light.gray3);
  expect(theme.gray2).toBe(defaultConfig.themes.light.gray2);
  expect(theme.buttonDefaultSecondary).toBe(theme.gray3);
});

it.each(['light', 'dark'] as const)(
  'uses monochrome primary and matching focus in %s',
  (appearance) => {
    const c = getBUITheme(appearance);
    const theme = createBUITamaguiTheme(appearance);
    expect([c.buttons.Primary[0], c.buttons.Primary[3]]).toEqual(
      appearance === 'light' ? ['#000000', '#FFFFFF'] : ['#FFFFFF', '#000000'],
    );
    expect(c.buttons.Primary[1]).toBe(c.primaryDisabled);
    expect(c.buttons.Primary[2]).toBe(c.primaryPressed);
    expect(theme.accentColor).toBe(c.primary);
    expect(theme.onAccent).toBe(c.primaryForeground);
    expect(theme.borderColorFocus).toBe(c.primary);
    expect(theme.tabActive).toBe(c.primary);
  },
);

it('feeds the same palette into semantic preview controls', () => {
  const theme = createBUITamaguiTheme('dark');
  expect(theme.gray10).toBe(buiBaseColors.dark.secondaryText);
  expect(theme.buttonDefaultSecondaryPress).toBe(buiBaseColors.dark.pressed);
  expect(theme.fieldBackground).toBe(buiBaseColors.dark.field);
});

it.each(['light', 'dark'] as const)(
  'defaults to monochrome and preserves button hierarchy in %s',
  (appearance) => {
    expect(getBUITheme(appearance).buttons.Primary).toEqual(
      expectedPalettes[appearance].buttons.Primary,
    );
    const c = getBUITheme(appearance);
    const native = createBUITamaguiTheme(appearance);
    expect(native.accentColor).toBe(c.primary);
    expect(native.onAccent).toBe(c.primaryForeground);
    expect(native.borderColorFocus).toBe(c.primary);
    expect(c.buttons.Secondary).toEqual(c.secondaryButton);
    expect(native.buttonDefaultSecondary).toBe(c.secondaryButton[0]);
    expect(native.buttonDefaultSecondaryText).toBe(c.buttons.Secondary[3]);
    if (appearance === 'light') {
      expect(c.secondaryButton).toEqual([
        defaultConfig.themes.light.gray3,
        defaultConfig.themes.light.gray2,
        defaultConfig.themes.light.gray4,
        '#000000',
      ]);
    } else {
      expect(c.secondaryButton).toEqual([
        buiBaseColors.dark.raised,
        buiBaseColors.dark.surface,
        buiBaseColors.dark.pressed,
        '#FFFFFF',
      ]);
    }
    expect(c.buttons.Tertiary[0]).toBe('transparent');
    expect(c.buttons.Tertiary[3]).toBe(c.primary);
    expect(c.buttons.Tertiary[2]).not.toBe('transparent');
    expect(c.switchInactive).toBe(c.raised);
  },
);

it.each(['light', 'dark'] as const)(
  'keeps purple accent opt-in and consistent across wallet and BUI in %s',
  (appearance) => {
    const c = getBUITheme(appearance);
    const wallet = createAppColorTheme(appearance);
    const bui = createBUITamaguiTheme(appearance);
    const buttons: Record<string, string> = buttonThemes[appearance];
    expect(c.buttons.Accent).toEqual(['#8A5CF5', c.raised, '#7848E0', '#FFFFFF']);
    for (const theme of [wallet, bui]) {
      expect(theme.primaryColor).toBe(c.primary);
      expect(theme.accentBackground).toBe(c.buttons.Accent[0]);
      expect(theme.accentForeground).toBe('#FFFFFF');
    }
    expect(buttons.buttonDefaultPrimary).toBe(c.primary);
    expect(buttons.buttonDefaultPrimary).not.toBe(buttons.buttonAccentPrimary);
    expect(buttons.buttonAccentPrimary).toBe(bui.buttonAccentPrimary);
    expect(buttons.buttonAccentPrimaryText).toBe('#FFFFFF');
    expect(buttons.buttonAccentDisabled).toBe(bui.buttonAccentDisabled);
    expect(buttons.buttonDisabled).toBe(bui.gray3);
    expect(buttons.buttonAccentDisabledText).toBe(c.disabledForeground);
    expect(buttons.buttonDisabledText).toBe(c.disabledForeground);
    expect(buttons.buttonSecondaryDisabledText).toBe(c.disabledForeground);
  },
);

it.each(['light', 'dark'] as const)(
  'keeps wallet, BUI and secondary buttons on the same gray roles in %s',
  (appearance) => {
    const wallet = createAppColorTheme(appearance);
    const bui = createBUITamaguiTheme(appearance);
    const buttons: Record<string, string> = buttonThemes[appearance];
    expect(wallet.gray2).toBe(bui.gray2);
    expect(wallet.gray3).toBe(bui.gray3);
    expect(buttons.buttonDefaultSecondary).toBe(wallet.gray3);
    expect(buttons.buttonSecondaryDisabled).toBe(wallet.gray2);
    expect(buttons.buttonDefaultSecondaryPress).toBe(wallet.gray4);
  },
);
