import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { appSpacing } from '~/shared/theme/appearance';
import { hapticService } from '~/services/platform/hapticService';

/** Snap expanded Home to its balance and mint sections, without clipping long mint lists. */
export function useHomePageScroll(enabled: boolean) {
  const measuredOffset = useRef<number | null>(null);
  const [mintOffset, setMintOffset] = useState<number | null>(null);
  const gesturePage = useRef<{ page: 0 | 1; epoch: number | undefined } | null>(null);
  useEffect(() => {
    gesturePage.current = null;
    setMintOffset(enabled ? measuredOffset.current : null);
  }, [enabled]);

  const onMintLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const offset = Math.max(0, event.nativeEvent.layout.y - appSpacing.page);
      measuredOffset.current = offset;
      gesturePage.current = null;
      if (enabled) setMintOffset(offset);
    },
    [enabled],
  );

  const ready = enabled && mintOffset !== null && mintOffset > 0;
  const finishSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!ready || gesturePage.current === null) return;
    const y = event.nativeEvent.contentOffset.y;
    // Wait for snapping to finish; the mint list remains freely scrollable below its start.
    if (Math.abs(y) > 2 && y < mintOffset! - 2) return;
    const page = y >= mintOffset! - 2 ? 1 : 0;
    const changed = page !== gesturePage.current.page;
    const eligible =
      gesturePage.current.epoch !== undefined &&
      gesturePage.current.epoch === hapticService.epoch();
    gesturePage.current = null;
    if (changed && eligible) hapticService.selection();
  };

  return {
    onMintLayout,
    scrollProps: {
      snapToOffsets: ready ? [0, mintOffset!] : undefined,
      snapToEnd: ready ? false : undefined,
      disableIntervalMomentum: ready,
      decelerationRate: ready ? ('fast' as const) : ('normal' as const),
      onScrollBeginDrag: ready
        ? (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            gesturePage.current = {
              page: event.nativeEvent.contentOffset.y >= mintOffset! / 2 ? 1 : 0,
              epoch: hapticService.epoch(),
            };
          }
        : undefined,
      onScrollEndDrag: ready
        ? (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (event.nativeEvent.velocity?.y === 0) finishSwipe(event);
          }
        : undefined,
      onMomentumScrollEnd: ready ? finishSwipe : undefined,
    },
  };
}
