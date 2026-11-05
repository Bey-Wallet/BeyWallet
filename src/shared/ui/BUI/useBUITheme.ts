import { useTheme, useThemeName } from 'tamagui';
import { useBUIStore, type BUIAppearance } from '~/state/buiStore';
import { getBUITheme } from './theme';

export function useBUITheme(appearanceOverride?: BUIAppearance) {
  const appearance = useBUIStore((state) => state.appearance);
  return getBUITheme(appearanceOverride ?? appearance);
}

/** Navigation chrome follows the active wallet/nested theme, never the catalog preference. */
export function useBUIChromeTheme() {
  const theme = useTheme();
  const name = useThemeName();
  const c = getBUITheme(name.startsWith('light') ? 'light' : 'dark');
  if (!name.includes('pos')) return c;
  return {
    ...c,
    primary: String(theme.buttonDefaultPrimary?.val),
    primaryPressed: String(theme.buttonDefaultPrimaryPress?.val),
    primaryForeground: String(theme.buttonDefaultPrimaryText?.val),
    canvas: String(theme.background.val),
    text: String(theme.color.val),
    muted: String(theme.gray10.val),
    separator: String(theme.borderColor.val),
    secondaryButton: [
      String(theme.buttonDefaultSecondary?.val),
      String(theme.buttonSecondaryDisabled.val),
      String(theme.buttonDefaultSecondaryPress?.val),
      String(theme.buttonDefaultSecondaryText?.val),
    ] as const,
  };
}
