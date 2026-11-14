import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { appSpacing } from '~/shared/theme/appearance';

/** Snap expanded Home to its balance and mint sections, without clipping long mint lists. */
export function useHomePageScroll(enabled: boolean) {
  const measuredOffset = useRef<number | null>(null);
  const [mintOffset, setMintOffset] = useState<number | null>(null);
  const currentPage = useRef(0);
  useEffect(() => {
    currentPage.current = 0;
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
  const onPageSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!ready || mintOffset === null) return;
      const y = event.nativeEvent.contentOffset.y;
      const page = Math.abs(y) <= 6 ? 0 : Math.abs(y - mintOffset) <= 6 ? 1 : null;
      if (page === null || page === currentPage.current) return;
      currentPage.current = page;
      void Haptics.selectionAsync().catch(() => {});
    },
    [ready, mintOffset],
  );

  return {
    onMintLayout,
    scrollProps: {
      snapToOffsets: ready ? [0, mintOffset!] : undefined,
      snapToEnd: ready ? false : undefined,
      disableIntervalMomentum: ready,
      decelerationRate: ready ? ('fast' as const) : ('normal' as const),
      onMomentumScrollEnd: onPageSettled,
      onScrollEndDrag: onPageSettled,
    },
  };
}
