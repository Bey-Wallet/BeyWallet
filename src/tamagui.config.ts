import { createAnimations } from '@tamagui/animations-react-native';
import { Text, createFont, createTamagui } from 'tamagui';
import { defaultConfig } from '@tamagui/config/v5';
import type { TextStyle } from 'react-native';
import {
  appColors,
  appRadii,
  appSpacing,
  appTypography,
  createAppColorTheme,
  createComponentColorThemes,
} from './shared/theme/appearance';

const tabularNumbers: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

// Base Text is unnamed in Tamagui, so named config defaults do not reach it.
// Update its existing defaults before configuring the named text variants below.
const baseText = Text as unknown as { staticConfig?: { defaultProps?: Record<string, unknown> } };
Object.assign(baseText.staticConfig?.defaultProps ?? {}, tabularNumbers, { fontFamily: '$body' });

// Keep this type independent of TamaguiCustomConfig, which is inferred from config below.
const textDefaults: Record<
  string,
  Pick<TextStyle, 'fontVariant' | 'fontFamily'>
> = Object.fromEntries(
  [
    'Text',
    'SizableText',
    'Paragraph',
    'Heading',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'Label',
    'Input',
    'TextArea',
    'Button',
    'ToastTitle',
    'ToastDescription',
    'DialogTitle',
    'DialogDescription',
    'AlertDialogTitle',
    'AlertDialogDescription',
    'ListItemText',
    'ListItemTitle',
    'ListItemSubtitle',
    'SelectItemText',
  ].map((name) => [name, { ...tabularNumbers, fontFamily: '$body' }]),
);

const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'timing',
    duration: 300,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1,
    stiffness: 250,
  },
});

const specialGothicFont = createFont({
  family: 'SpecialGothicRegular',
  size: {
    1: appTypography.caption.fontSize,
    2: 12,
    3: appTypography.body2.fontSize,
    4: appTypography.body1.fontSize,
    5: 16,
    6: appTypography.title3.fontSize,
    7: 20,
    8: appTypography.title2.fontSize,
    9: appTypography.title1.fontSize,
    10: 46,
    11: 54,
    12: 63,
    13: 72,
    14: 82,
    15: 92,
    16: 124,
  },
  lineHeight: {
    1: appTypography.caption.lineHeight,
    2: appTypography.body3.lineHeight,
    3: appTypography.body2.lineHeight,
    4: appTypography.body1.lineHeight,
    5: appTypography.label1.lineHeight,
    6: appTypography.title3.lineHeight,
    7: appTypography.title3.lineHeight,
    8: appTypography.title2.lineHeight,
    9: appTypography.title1.lineHeight,
    10: 53,
    11: 61,
    12: 70,
    13: 79,
    14: 89,
    15: 99,
    16: 131,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    1000: '1000',
    bold: 'bold',
  },
  letterSpacing: {
    4: appTypography.body1.letterSpacing,
    8: appTypography.title2.letterSpacing,
  },
  face: {
    100: { normal: 'SpecialGothicRegular' },
    200: { normal: 'SpecialGothicRegular' },
    300: { normal: 'SpecialGothicRegular' },
    400: { normal: 'SpecialGothicRegular' },
    500: { normal: 'SpecialGothicMedium' },
    600: { normal: 'SpecialGothicSemiBold' },
    700: { normal: 'SpecialGothicSemiBold' },
    800: { normal: 'SpecialGothicSemiBold' },
    900: { normal: 'SpecialGothicSemiBold' },
    1000: { normal: 'SpecialGothicSemiBold' },
    bold: { normal: 'SpecialGothicSemiBold' },
  },
});

const monoFont = createFont({
  family: 'Mono',
  size: specialGothicFont.size,
  lineHeight: specialGothicFont.lineHeight,
  weight: {
    4: '400',
    5: '500',
    6: '600',
  },
  letterSpacing: {
    4: appTypography.mono.letterSpacing,
    8: 1,
  },
  face: {
    400: { normal: 'Mono' },
    500: { normal: 'Mono' },
    600: { normal: 'Mono' },
    bold: { normal: 'Mono' },
  },
});

const superblueColors = {
  superblue1: 'hsl(206, 100%, 97.0%)',
  superblue2: 'hsl(207, 98.0%, 90.0%)',
  superblue3: 'hsl(207, 95.0%, 78.0%)',
  superblue4: 'hsl(208, 98.0%, 62.0%)',
  superblue5: 'hsl(208, 100%, 47.3%)', // Matches blue10 exactly
  superblue6: 'hsl(209, 100%, 43.0%)',
  superblue7: 'hsl(210, 100%, 39.0%)',
  superblue8: 'hsl(211, 100%, 35.0%)',
  superblue9: 'hsl(212, 100%, 31.0%)',
  superblue10: 'hsl(213, 100%, 27.0%)', // Rich royal blue
  superblue11: 'hsl(214, 100%, 22.0%)',
  superblue12: 'hsl(215, 100%, 15.0%)',
};

const beyblueColors = {
  // 1-12 scale
  beyblue1: '#eaf0ff',
  beyblue2: '#bdd1ff',
  beyblue3: '#9dbaff',
  beyblue4: '#709bff',
  beyblue5: '#5588ff',
  beyblue6: '#2a6aff',
  beyblue7: '#2660e8',
  beyblue8: '#1e4bb5',
  beyblue9: '#173a8c',
  beyblue10: '#122d6b',
  beyblue11: '#0f2354',
  beyblue12: '#0a183b',

  // 50-900 scale
  beyblue50: '#eaf0ff',
  beyblue100: '#bdd1ff',
  beyblue200: '#9dbaff',
  beyblue300: '#709bff',
  beyblue400: '#5588ff',
  beyblue500: '#2a6aff',
  beyblue600: '#2660e8',
  beyblue700: '#1e4bb5',
  beyblue800: '#173a8c',
  beyblue900: '#122d6b',
};

const surfaceColors = {
  // 1-12 scale
  surface1: '#ebebeb',
  surface2: '#c1c1c1',
  surface3: '#a3a3a3',
  surface4: '#7a7a7a',
  surface5: '#606060',
  surface6: '#383838',
  surface7: '#333333',
  surface8: '#282828',
  surface9: '#1f1f1f',
  surface10: '#181818',
  surface11: '#121212',
  surface12: '#0a0a0a',

  // 50-900 scale
  surface50: '#ebebeb',
  surface100: '#c1c1c1',
  surface200: '#a3a3a3',
  surface300: '#7a7a7a',
  surface400: '#606060',
  surface500: '#383838',
  surface600: '#333333',
  surface700: '#282828',
  surface800: '#1f1f1f',
  surface900: '#181818',
};

const blend = (background: string, foreground: string, amount: number) =>
  `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        parseInt(background.slice(offset, offset + 2), 16) * (1 - amount) +
          parseInt(foreground.slice(offset, offset + 2), 16) * amount,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

function createButtonTheme(dark: boolean) {
  const c = appColors[dark ? 'dark' : 'light'];
  const neutral = [c.secondaryButton, c.secondaryButtonHighlighted, c.secondaryButtonHighlighted];
  const primary = [c.accent, c.accentHover, c.accentPress];
  const semantic = (background: string, color: string) => [
    background,
    blend(background, color, 0.08),
    blend(background, color, 0.14),
  ];
  const criticalColor = dark ? '#FCA5A5' : '#991B1B';
  const warningColor = dark ? '#FCD34D' : '#92400E';
  const palette = (
    name: string,
    primary: string[],
    primaryText: string,
    secondary: string[],
    secondaryText: string,
    text: string,
  ) => ({
    [`button${name}Primary`]: primary[0],
    [`button${name}PrimaryHover`]: primary[1],
    [`button${name}PrimaryPress`]: primary[2],
    [`button${name}PrimaryText`]: primaryText,
    [`button${name}Secondary`]: secondary[0],
    [`button${name}SecondaryHover`]: secondary[1],
    [`button${name}SecondaryPress`]: secondary[2],
    [`button${name}SecondaryText`]: secondaryText,
    [`button${name}Text`]: text,
  });
  return {
    ...palette(
      'Default',
      primary,
      c.onAccent,
      [c.surface, c.raised, c.pressed],
      c.buttonForeground,
      c.accent,
    ),
    ...palette('Branded', primary, c.onAccent, neutral, c.buttonForeground, c.accent),
    ...palette(
      'Critical',
      ['#B91C1C', '#991B1B', '#7F1D1D'],
      '#FFFFFF',
      semantic(dark ? '#450A0A' : '#FEE2E2', criticalColor),
      criticalColor,
      criticalColor,
    ),
    ...palette(
      'Warning',
      ['#FBBF24', '#F59E0B', '#D97706'],
      '#181818',
      semantic(dark ? '#451A03' : '#FEF3C7', warningColor),
      warningColor,
      warningColor,
    ),
    buttonDisabled: c.accentDisabled,
    buttonDisabledText: c.onAccent,
    buttonSecondaryDisabled: c.secondaryButtonDisabled,
    buttonSecondaryDisabledText: c.tertiaryText,
    buttonTertiary: c.tertiaryButton,
    buttonTertiaryHighlighted: c.tertiaryButtonHighlighted,
    buttonTertiaryDisabled: c.tertiaryButtonDisabled,
    buttonFocus: c.accent,
    buttonBrandedTextHover: c.accent,
    buttonBrandedTextPress: c.accent,
  };
}

export const buttonThemes = { light: createButtonTheme(false), dark: createButtonTheme(true) };

export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    radius: {
      ...defaultConfig.tokens.radius,
      1: appRadii.tiny,
      2: appRadii.tiny,
      3: appRadii.small,
      4: appRadii.small,
      5: appRadii.control,
      6: appRadii.card,
      7: appRadii.sheet,
      8: appRadii.sheet,
      true: appRadii.card,
    },
    space: {
      ...defaultConfig.tokens.space,
      page: appSpacing.page,
      section: appSpacing.large,
      rowGap: appSpacing.gap,
    },
  },
  // Styled text components have their own names; Text defaults alone do not cover them.
  defaultProps: textDefaults,
  animations,
  settings: {
    ...defaultConfig.settings,
    allowedStyleValues: false,
    onlyAllowShorthands: false,
  },
  fonts: {
    ...defaultConfig.fonts,
    heading: specialGothicFont,
    body: specialGothicFont,
    mono: monoFont,
  },
  themes: {
    ...defaultConfig.themes,
    ...createComponentColorThemes(),
    light: {
      ...defaultConfig.themes.light,
      ...superblueColors,
      ...beyblueColors,
      ...surfaceColors,
      ...createAppColorTheme('light'),
      ...buttonThemes.light,
    },
    dark: {
      ...defaultConfig.themes.dark,
      ...superblueColors,
      ...beyblueColors,
      ...surfaceColors,
      ...createAppColorTheme('dark'),
      ...buttonThemes.dark,
    },
  },
});

export default config;

export type Conf = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
