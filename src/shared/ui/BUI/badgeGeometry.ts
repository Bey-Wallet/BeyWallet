export type BUIBadgeDirection = 'EndTop' | 'StartTop' | 'EndBottom' | 'StartBottom';
export type BUIBadgeStrategy = 'Circle' | 'Square' | 'Corner';

/** Source placement in physical pixels; Kotlin truncates offsets toward zero. */
export function buiBadgeOffset(
  strategy: BUIBadgeStrategy,
  direction: BUIBadgeDirection,
  parent: { width: number; height: number },
  badge: { width: number; height: number },
  density = 1,
) {
  const width = Math.round(parent.width * density);
  const height = Math.round(parent.height * density);
  const bw = Math.round(badge.width * density);
  const bh = Math.round(badge.height * density);
  const end = direction.startsWith('End');
  const bottom = direction.endsWith('Bottom');
  if (strategy === 'Corner')
    return { x: (end ? width : -bw) / density, y: (bottom ? height - bh : 0) / density };
  const cx = width / 2;
  const cy = height / 2;
  const diagonal = Math.min(cx, cy) * Math.sin(Math.PI / 4);
  const x = strategy === 'Circle' ? cx + (end ? diagonal : -diagonal) : end ? width : 0;
  const y = strategy === 'Circle' ? cy + (bottom ? diagonal : -diagonal) : bottom ? height : 0;
  return { x: Math.trunc(x - bw / 2) / density, y: Math.trunc(y - bh / 2) / density };
}
