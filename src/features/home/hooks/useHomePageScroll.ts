import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { appSpacing } from '~/shared/theme/appearance';

/** Snap expanded Home to its balance and mint sections, without clipping long mint lists. */
export function useHomePageScroll(enabled: boolean) {
  const measuredOffset = useRef<number | null>(null);
  const [mintOffset, setMintOffset] = useState<number | null>(null);
  useEffect(() => {
    setMintOffset(enabled ? measuredOffset.current : null);
  }, [enabled]);

  const onMintLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const offset = Math.max(0, event.nativeEvent.layout.y - appSpacing.page);
      measuredOffset.current = offset;
      if (enabled) setMintOffset(offset);
    },
    [enabled],
  );

  const ready = enabled && mintOffset !== null && mintOffset > 0;

  return {
    onMintLayout,
    scrollProps: {
      snapToOffsets: ready ? [0, mintOffset!] : undefined,
      snapToEnd: ready ? false : undefined,
      disableIntervalMomentum: ready,
      decelerationRate: ready ? ('fast' as const) : ('normal' as const),
    },
  };
}
