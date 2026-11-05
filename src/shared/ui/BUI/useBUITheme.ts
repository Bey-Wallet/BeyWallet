import { useBUIStore, type BUIAppearance } from '~/state/buiStore';
import { getBUITheme } from './theme';

export function useBUITheme(appearanceOverride?: BUIAppearance) {
  const appearance = useBUIStore((state) => state.appearance);
  return getBUITheme(appearanceOverride ?? appearance);
}
