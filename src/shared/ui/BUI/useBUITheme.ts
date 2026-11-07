import { useTheme, useThemeName } from 'tamagui';
import { createContext, useContext } from 'react';
import { useBUIStore, type BUIAppearance } from '~/state/buiStore';
import { getBUITheme } from './theme';

const BUIAppearanceContext = createContext<BUIAppearance | undefined>(undefined);
/** Scope production BUI content without changing the catalog preference. */
export const BUIAppearanceProvider = BUIAppearanceContext.Provider;

export function useBUIAppearance() {
  const catalog = useBUIStore((state) => state.appearance);
  return useContext(BUIAppearanceContext) ?? catalog;
}

export function useBUITheme(appearanceOverride?: BUIAppearance) {
  const appearance = useBUIStore((state) => state.appearance);
  const scopedAppearance = useContext(BUIAppearanceContext);
  return getBUITheme(appearanceOverride ?? scopedAppearance ?? appearance);
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
