/** Source: tonkeeper/android, commit 16f00a8a91ad9e47bee33cd0c9cf404a05e89339.
 * kmp/ui/src/commonMain/kotlin/ui/theme/{dark,light}.kt; see docs/theme.md.
 */
export type BeyThemeMode = 'light' | 'dark';

/** Android stores alpha first; React Native's eight-digit hex stores it last. */
export function androidColorToRgba(value: string): string {
  if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) throw new Error('Invalid source color');
  return value.length === 9 ? `#${value.slice(3)}${value.slice(1, 3)}` : value;
}

const dark = {
  textPrimary: '#D9D9D9',
  textSecondary: '#8D8D93',
  textTertiary: '#4E4E52',
  textAccent: '#3C95FA',
  textPrimaryAlternate: '#000000',
  backgroundPage: '#000000',
  backgroundPageAlternate: '#000000',
  backgroundTransparent: '#F5000000',
  backgroundContent: '#17171A',
  backgroundContentAlternate: '#17171A',
  backgroundContentTint: '#222224',
  backgroundContentAttention: '#2F2F33',
  backgroundHighlighted: '#0AFFFFFF',
  backgroundOverlayStrong: '#B80F0F0F',
  backgroundOverlayLight: '#7A0F0F0F',
  backgroundOverlayExtraLight: '#3D0F0F0F',
  iconPrimary: '#FFFFFF',
  iconSecondary: '#8D8D93',
  iconTertiary: '#4E4E52',
  iconPrimaryAlternate: '#000000',
  buttonPrimaryBackground: '#3C95FA',
  buttonPrimaryBackgroundDisabled: '#387BC7',
  buttonPrimaryBackgroundHighlighted: '#55A2FA',
  buttonPrimaryForeground: '#FFFFFF',
  buttonSecondaryBackground: '#17171A',
  buttonSecondaryBackgroundDisabled: '#0E0E0F',
  buttonSecondaryBackgroundHighlighted: '#202024',
  buttonSecondaryForeground: '#FFFFFF',
  buttonTertiaryBackground: '#222224',
  buttonTertiaryBackgroundDisabled: '#18181A',
  buttonTertiaryBackgroundHighlighted: '#2A2A2E',
  buttonTertiaryForeground: '#FFFFFF',
  buttonGreenBackground: '#39CC83',
  buttonGreenBackgroundDisabled: '#2B9962',
  buttonGreenBackgroundHighlighted: '#49CC8B',
  buttonGreenForeground: '#FFFFFF',
  buttonOrangeBackground: '#F5A73B',
  buttonOrangeBackgroundDisabled: '#D68B2F',
  buttonOrangeBackgroundHighlighted: '#FFC25E',
  buttonOrangeForeground: '#FFFFFF',
  buttonRedBackground: '#FF4766',
  buttonRedBackgroundDisabled: '#C2364E',
  buttonRedBackgroundHighlighted: '#FF5E79',
  buttonRedForeground: '#FFFFFF',
  fieldBackground: '#17171A',
  fieldActiveBorder: '#3C95FA',
  fieldErrorBorder: '#FF4766',
  fieldErrorBackground: '#14FF4766',
  accentBlue: '#3C95FA',
  accentGreen: '#39CC83',
  accentRed: '#FF4766',
  accentOrange: '#F5A73B',
  accentPurple: '#7665E5',
  tabBarActiveIcon: '#3C95FA',
  tabBarInactiveIcon: '#8D8D93',
  separatorCommon: '#14FFFFFF',
  separatorAlternate: '#14FFFFFF',
};

export type BeyColorRole = keyof typeof dark;
export type BeyColorScheme = Readonly<Record<BeyColorRole, string>>;

const light: Record<BeyColorRole, string> = {
  textPrimary: '#000000',
  textSecondary: '#818C99',
  textTertiary: '#95A0AD',
  textAccent: '#007AFF',
  textPrimaryAlternate: '#FFFFFF',
  backgroundPage: '#EFEEF3',
  backgroundPageAlternate: '#FFFFFF',
  backgroundTransparent: '#F5FFFFFF',
  backgroundContent: '#FFFFFF',
  backgroundContentAlternate: '#EFEEF3',
  backgroundContentTint: '#E7E6EB',
  backgroundContentAttention: '#F0F0F0',
  backgroundHighlighted: '#14818C99',
  backgroundOverlayStrong: '#B8141414',
  backgroundOverlayLight: '#7A141414',
  backgroundOverlayExtraLight: '#3D141414',
  iconPrimary: '#000000',
  iconSecondary: '#818C99',
  iconTertiary: '#95A0AD',
  iconPrimaryAlternate: '#FFFFFF',
  buttonPrimaryBackground: '#007AFF',
  buttonPrimaryBackgroundDisabled: '#3D9AFF',
  buttonPrimaryBackgroundHighlighted: '#1F8AFF',
  buttonPrimaryForeground: '#FFFFFF',
  buttonSecondaryBackground: '#D3D4DB',
  buttonSecondaryBackgroundDisabled: '#D8D9E0',
  buttonSecondaryBackgroundHighlighted: '#C9CAD1',
  buttonSecondaryForeground: '#000000',
  buttonTertiaryBackground: '#D3D4DB',
  buttonTertiaryBackgroundDisabled: '#D8D9E0',
  buttonTertiaryBackgroundHighlighted: '#C9CAD1',
  buttonTertiaryForeground: '#000000',
  buttonGreenBackground: '#25B86F',
  buttonGreenBackgroundDisabled: '#2B9962',
  buttonGreenBackgroundHighlighted: '#17C26D',
  buttonGreenForeground: '#FFFFFF',
  buttonOrangeBackground: '#F5A73B',
  buttonOrangeBackgroundDisabled: '#D68B2F',
  buttonOrangeBackgroundHighlighted: '#FFC25E',
  buttonOrangeForeground: '#FFFFFF',
  buttonRedBackground: '#FF3B30',
  buttonRedBackgroundDisabled: '#C2364E',
  buttonRedBackgroundHighlighted: '#FF5E79',
  buttonRedForeground: '#FFFFFF',
  fieldBackground: '#1F818C99',
  fieldActiveBorder: '#007AFF',
  fieldErrorBorder: '#FF3B30',
  fieldErrorBackground: '#14FF3B30',
  accentBlue: '#007AFF',
  accentGreen: '#25B86F',
  accentRed: '#FF3B30',
  accentOrange: '#F5A73B',
  accentPurple: '#7665E5',
  tabBarActiveIcon: '#007AFF',
  tabBarInactiveIcon: '#95A0AD',
  separatorCommon: '#1F3C3C43',
  separatorAlternate: '#143C3C43',
};

function convertPalette(source: Record<BeyColorRole, string>): BeyColorScheme {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(source).map(([role, color]) => [role, androidColorToRgba(color)]),
    ),
  ) as BeyColorScheme;
}

export const beyColors = Object.freeze({
  dark: convertPalette(dark),
  light: convertPalette(light),
});
export type BeyThemeColorKey = `bey${Capitalize<BeyColorRole>}`;
export function beyColorKey(role: BeyColorRole): BeyThemeColorKey {
  return `bey${role[0].toUpperCase()}${role.slice(1)}` as BeyThemeColorKey;
}

export function createBeyTheme(mode: BeyThemeMode) {
  const colors = beyColors[mode];
  const roles = Object.fromEntries(
    Object.entries(colors).map(([role, color]) => [beyColorKey(role as BeyColorRole), color]),
  ) as Record<BeyThemeColorKey, string>;
  return {
    ...roles,
    background: colors.backgroundPage,
    color: colors.textPrimary,
    borderColor: colors.separatorCommon,
    accentColor: colors.accentBlue,
    // AppPressable's existing keyboard focus ring reads blue10. Scope the bridge to Bey themes.
    blue10: colors.accentBlue,
  };
}

export const beyThemeNames = { dark: 'dark_bey', light: 'light_bey' } as const;
