export const buiSpacing = {
  tiny: 2,
  extraSmall: 4,
  compact: 8,
  gap: 12,
  medium: 16,
  section: 24,
  large: 32,
} as const;
export const buiRadii = {
  none: 0,
  tiny: 4,
  extraSmall: 8,
  small: 12,
  item: 16,
  card: 20,
  pill: 1000,
} as const;
export const buiDimensions = {
  action: 32,
  item: 56,
  header: 64,
  bottomBar: 84,
  touchTarget: 48,
} as const;
export const buiRowLayout = {
  paddingX: 16,
  paddingY: 8,
  iconGap: 16,
  textGap: 2,
  trailingGap: 8,
} as const;
export const buiSeparator = { thickness: 0.5, startInset: 16 } as const;

// A measured bar consumes the corresponding system inset rather than adding it twice.
export function buiContentInsets({
  topBar,
  bottomBar,
  top,
  bottom,
}: {
  topBar?: number;
  bottomBar?: number;
  top: number;
  bottom: number;
}) {
  return { top: topBar ?? top, bottom: bottomBar ?? bottom };
}
