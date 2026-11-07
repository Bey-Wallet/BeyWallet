export function buiHeaderTitleScale(naturalWidth: number, availableWidth: number) {
  if (naturalWidth <= 0 || availableWidth <= 0) return 1;
  let scale = 1;
  while (naturalWidth * scale > availableWidth && scale > 0.85)
    scale = Math.max(0.85, scale * 0.95);
  return scale;
}

export function buiHeaderTitleInset(navigationWidth: number, actionsWidth: number) {
  return 16 + Math.max(navigationWidth, actionsWidth) + 4;
}

export function buiLargeHeaderHeight(offset: number, density = 1) {
  return Math.round(Math.max(0, Math.min(84, 84 - offset)) * density) / density;
}
