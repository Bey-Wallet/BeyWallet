/** Tonkeeper Dimens.kt and ui/uikit/core/src/main/res/values/dimens.xml. */
export const beyRadii = {
  none: 0,
  xxs: 4,
  xs: 8,
  small: 12,
  medium: 16,
  large: 20,
  pill: 999,
} as const;
export const beySpacing = { xxs: 2, xs: 4, gap: 12, medium: 16, large: 32 } as const;
export const beyDimensions = {
  action: 32,
  item: 56,
  bar: 64,
  actionBar: 84,
  tertiary: 36,
  icon: 28,
  // Bey accessibility requirement; source-sized glyphs remain inside this target.
  touchTarget: 48,
} as const;

export const beyRadiusTokens = {
  beyNone: beyRadii.none,
  beyXxs: beyRadii.xxs,
  beyXs: beyRadii.xs,
  beySmall: beyRadii.small,
  beyMedium: beyRadii.medium,
  beyLarge: beyRadii.large,
  beyPill: beyRadii.pill,
};
export const beySpaceTokens = {
  beyXxs: beySpacing.xxs,
  beyXs: beySpacing.xs,
  beyGap: beySpacing.gap,
  beyMedium: beySpacing.medium,
  beyLarge: beySpacing.large,
};
export const beySizeTokens = {
  beyAction: beyDimensions.action,
  beyItem: beyDimensions.item,
  beyBar: beyDimensions.bar,
  beyActionBar: beyDimensions.actionBar,
  beyTertiary: beyDimensions.tertiary,
  beyIcon: beyDimensions.icon,
  beyTouchTarget: beyDimensions.touchTarget,
};
