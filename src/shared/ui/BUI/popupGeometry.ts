import type { BUIRect } from './selectorGeometry';

export function buiTooltipLayout({
  anchor,
  window,
  contentHeight,
  naturalWidth,
  maxWidth = 200,
  gap = 4,
  preferAbove = false,
  centerTail = false,
}: {
  anchor: BUIRect;
  window: { width: number; height: number };
  contentHeight: number;
  naturalWidth?: number;
  maxWidth?: number;
  gap?: number;
  preferAbove?: boolean;
  centerTail?: boolean;
}) {
  const center = anchor.x + anchor.width / 2;
  const idealLeft = center - 25;
  const cap = Math.max(120, Math.min(288, window.width - 16 - Math.max(0, idealLeft)));
  const width = Math.max(0, Math.min(naturalWidth ?? maxWidth, maxWidth, cap, window.width));
  const height = Math.max(0, Math.min(contentHeight + 6, window.height));
  const initialX = centerTail
    ? Math.max(16, Math.min(center - width / 2, Math.max(16, window.width - 16 - width)))
    : Math.max(0, Math.min(idealLeft, Math.max(0, window.width - cap)));
  const x = Math.max(0, Math.min(initialX, window.width - width));
  const below = anchor.y + anchor.height + gap;
  const above = anchor.y - height - gap;
  const useAbove = preferAbove ? above >= 0 : below + height > window.height && above >= 0;
  const y = Math.max(0, Math.min(useAbove ? above : below, window.height - height));
  const tailLeft = centerTail
    ? Math.max(0, (width - 14) / 2)
    : Math.min(18, Math.max(0, width - 14));
  return {
    x,
    y,
    width,
    height,
    tailOnTop: !useAbove,
    tailLeft,
    originX: centerTail ? width / 2 : Math.max(width * 0.05, Math.min(25, width * 0.95)),
    originY: useAbove ? height : 0,
  };
}
