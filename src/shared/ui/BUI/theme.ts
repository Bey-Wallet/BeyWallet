import type { BUIAppearance } from '~/state/buiStore';
import { defaultConfig } from '@tamagui/config/v5';
import { buiBaseColors, buiButtonPalettes } from './palettes';

const lightGray = defaultConfig.themes.light;

export const buiColors = {
  light: {
    ...buiBaseColors.light,
    canvas: '#FFFFFF',
    surface: lightGray.gray2,
    raised: lightGray.gray3,
    pressed: lightGray.gray4,
    field: lightGray.gray2,
    alternateSurface: '#FFFFFF',
  },
  dark: buiBaseColors.dark,
} as const;
export const buiButtonSizes = {
  small: { height: 36, radius: 18, fontSize: 14 },
  medium: { height: 48, radius: 24, fontSize: 16 },
  large: { height: 56, radius: 16, fontSize: 16 },
} as const;
export const buiButtonVariants = [
  'Primary',
  'Accent',
  'Secondary',
  'Tertiary',
  'Green',
  'Orange',
  'Red',
] as const;
export type BUIButtonVariant = (typeof buiButtonVariants)[number];
export type BUIButtonSize = keyof typeof buiButtonSizes;
export type BUIButtonState = 'Default' | 'Highlighted' | 'Disabled' | 'Loading';

export function getBUITheme(appearance: BUIAppearance) {
  const c = buiColors[appearance];
  const disabledPalette = (palette: readonly [string, string, string, string]) =>
    [palette[0], c.raised, palette[2], palette[3]] as const;
  const primary = disabledPalette(buiButtonPalettes[appearance].Primary);
  const accent = disabledPalette(buiButtonPalettes[appearance].Accent);
  const secondary =
    appearance === 'light'
      ? ([lightGray.gray3, lightGray.gray2, lightGray.gray4, '#000000'] as const)
      : ([c.raised, c.surface, c.pressed, '#FFFFFF'] as const);
  return {
    ...c,
    primary: primary[0],
    primaryDisabled: primary[1],
    primaryPressed: primary[2],
    primaryForeground: primary[3],
    disabledForeground: c.secondaryText,
    accent: buiButtonPalettes[appearance].Accent[0],
    accentForeground: buiButtonPalettes[appearance].Accent[3],
    fieldActiveBorder: primary[0],
    tabActive: primary[0],
    page: c.canvas,
    content: c.surface,
    tint: c.raised,
    muted: c.secondaryText,
    switchInactive: c.raised,
    tertiaryFill: c.raised,
    secondaryButton: secondary,
    buttons: {
      ...buiButtonPalettes[appearance],
      Primary: primary,
      Accent: accent,
      Green: disabledPalette(buiButtonPalettes[appearance].Green),
      Orange: disabledPalette(buiButtonPalettes[appearance].Orange),
      Red: disabledPalette(buiButtonPalettes[appearance].Red),
      Secondary: secondary,
      Tertiary: ['transparent', 'transparent', c.highlighted, primary[0]] as const,
    },
  };
}

/** Local BUI theme; registered separately so production appearances stay intact. */
export function createBUITamaguiTheme(appearance: BUIAppearance) {
  const c = getBUITheme(appearance);
  const primary = c.buttons.Primary;
  const secondary = c.secondaryButton;
  return {
    background: c.canvas,
    backgroundHover: c.raised,
    backgroundPress: c.pressed,
    backgroundFocus: c.raised,
    color: c.text,
    colorHover: c.text,
    colorPress: c.text,
    colorFocus: c.text,
    color1: c.text,
    color2: c.surface,
    color3: c.raised,
    color4: c.secondaryText,
    color5: c.raised,
    color8: c.tertiaryText,
    color10: c.secondaryText,
    color11: c.text,
    color12: c.text,
    gray1: c.canvas,
    gray2: c.surface,
    gray3: appearance === 'light' ? lightGray.gray3 : c.raised,
    gray4: appearance === 'light' ? lightGray.gray4 : c.pressed,
    gray5: appearance === 'light' ? lightGray.gray5 : c.pressed,
    gray8: c.tertiaryText,
    gray9: c.tertiaryText,
    gray10: c.secondaryText,
    gray11: c.text,
    gray12: c.text,
    borderColor: c.separator,
    borderColorHover: c.secondaryText,
    borderColorFocus: c.fieldActiveBorder,
    placeholderColor: c.secondaryText,
    primaryColor: c.primary,
    onPrimary: c.primaryForeground,
    accentBackground: c.accent,
    accentForeground: c.accentForeground,
    // Compatibility aliases preserve the existing monochrome controls.
    accentColor: c.primary,
    onAccent: c.primaryForeground,
    blue9: c.primary,
    blue10: c.primary,
    blue11: c.primary,
    blue12: c.primary,
    iconPrimary: c.icon,
    iconSecondary: c.iconSecondary,
    iconTertiary: c.iconTertiary,
    fieldBackground: c.field,
    fieldErrorBorder: c.fieldErrorBorder,
    fieldErrorBackground: c.fieldError,
    backgroundAlternate: c.alternateCanvas,
    surfaceAlternate: c.alternateSurface,
    sheetBackground: c.surface,
    backgroundTransparent: c.transparentCanvas,
    backgroundHighlighted: c.highlighted,
    overlayStrong: c.overlayStrong,
    overlayLight: c.overlayLight,
    overlayExtraLight: c.overlayExtraLight,
    separatorAlternate: c.alternateSeparator,
    tabActive: c.tabActive,
    tabInactive: c.tabInactive,
    green10: c.positive,
    green11: c.positive,
    red3: c.fieldError,
    red10: c.negative,
    red11: c.negative,
    orange10: c.warning,
    yellow10: c.warning,
    purple10: c.purple,
    buttonDefaultPrimary: primary[0],
    buttonDefaultPrimaryHover: primary[2],
    buttonDefaultPrimaryPress: primary[2],
    buttonDefaultPrimaryText: primary[3],
    buttonDefaultSecondary: secondary[0],
    buttonDefaultSecondaryHover: secondary[2],
    buttonDefaultSecondaryPress: secondary[2],
    buttonDefaultSecondaryText: secondary[3],
    buttonDefaultText: c.text,
    buttonAccentPrimary: c.buttons.Accent[0],
    buttonAccentPrimaryHover: c.buttons.Accent[2],
    buttonAccentPrimaryPress: c.buttons.Accent[2],
    buttonAccentPrimaryText: c.buttons.Accent[3],
    buttonAccentSecondary: secondary[0],
    buttonAccentSecondaryHover: secondary[2],
    buttonAccentSecondaryPress: secondary[2],
    buttonAccentSecondaryText: c.accent,
    buttonAccentText: c.accent,
    buttonAccentDisabled: c.buttons.Accent[1],
    buttonAccentDisabledText: c.disabledForeground,
    buttonDisabled: primary[1],
    buttonDisabledText: c.disabledForeground,
    buttonSecondaryDisabled: secondary[1],
    buttonSecondaryDisabledText: c.disabledForeground,
    buttonGhostHighlighted: c.buttons.Tertiary[2],
    buttonFocus: c.primary,
  };
}
