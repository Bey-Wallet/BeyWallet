export type BUIRect = { x: number; y: number; width: number; height: number };

// Source popup placement: 0 at start edge, 16 at end, below-first with above fallback.
export function buiSelectorPosition(
  anchor: BUIRect,
  window: { width: number; height: number },
  menu: { width: number; height: number },
  alignment: 'start' | 'center' = 'center',
  rtl = false,
  offset = { x: 0, y: 12 },
) {
  const initialX =
    alignment === 'center'
      ? anchor.x + anchor.width / 2 - menu.width / 2 + offset.x
      : rtl
        ? anchor.x + anchor.width - menu.width - offset.x
        : anchor.x + offset.x;
  const x = Math.max(0, Math.min(initialX, Math.max(0, window.width - menu.width - 16)));
  const below = anchor.y + anchor.height + offset.y;
  const above = anchor.y - menu.height - offset.y;
  let y = Math.max(0, below);
  if (below + menu.height > window.height) {
    y =
      above >= 0
        ? above
        : window.height - anchor.y - anchor.height >= anchor.y
          ? Math.min(below, window.height - menu.height)
          : Math.max(0, above);
  }
  // Height is constrained to the viewport before placement.
  y = Math.max(0, Math.min(y, Math.max(0, window.height - menu.height)));
  const originX =
    x >= anchor.x + anchor.width
      ? 0
      : x + menu.width <= anchor.x
        ? menu.width
        : (Math.max(x, anchor.x) + Math.min(x + menu.width, anchor.x + anchor.width)) / 2 - x;
  const originY =
    y >= anchor.y + anchor.height
      ? 0
      : y + menu.height <= anchor.y
        ? menu.height
        : (Math.max(y, anchor.y) + Math.min(y + menu.height, anchor.y + anchor.height)) / 2 - y;
  return { x, y, originX, originY };
}

export function buiChipScrollOffset(
  current: number,
  viewport: number,
  item: { x: number; width: number },
) {
  if (item.x < current + 16) return Math.max(0, item.x - 16);
  if (item.x + item.width > current + viewport - 16)
    return Math.max(0, item.x + item.width - viewport + 16);
  return current;
}
