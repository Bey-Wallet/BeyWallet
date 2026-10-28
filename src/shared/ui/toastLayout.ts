import type { EdgeInsets } from 'react-native-safe-area-context';

export function getToastLayout(windowWidth: number, insets: EdgeInsets) {
  // Symmetric gutters keep the card centered even with a cutout on one side.
  const gutter = Math.max(insets.left, insets.right) + 16;
  return {
    top: insets.top + 12,
    gutter,
    width: Math.min(360, Math.max(0, windowWidth - gutter * 2)),
  };
}
