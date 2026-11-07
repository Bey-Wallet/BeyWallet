import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUIAppearance } from './useBUITheme';
import type { BUIRect } from './selectorGeometry';

export function useBUIAnchoredPopup(kind: 'menu' | 'tooltip', enabled = true, iconAnchor = false) {
  const trigger = useRef<React.ElementRef<typeof AppPressable>>(null);
  const [anchor, setAnchor] = useState<BUIRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const focused = useIsFocused();
  const appearance = useBUIAppearance();
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const tooltip = kind === 'tooltip';
  const hiddenScale = tooltip ? 0.3 : 0.8;
  const alpha = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(hiddenScale)).current;
  const reset = useCallback(() => {
    generation.current += 1;
    active.current = false;
    setExpanded(false);
    setAnchor(null);
  }, []);
  useEffect(() => {
    reset();
    return () => {
      generation.current += 1;
      active.current = false;
    };
  }, [window.width, window.height, window.fontScale, appearance, focused, enabled, reset]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') reset();
    });
    return () => subscription.remove();
  }, [reset]);
  useEffect(() => {
    if (!anchor) {
      alpha.setValue(0);
      scale.setValue(hiddenScale);
      return;
    }
    if (reducedMotion) {
      alpha.setValue(expanded ? 1 : 0);
      scale.setValue(expanded ? 1 : hiddenScale);
      if (!expanded) setAnchor(null);
      return;
    }
    const easing = expanded ? Easing.bezier(0, 0, 0.2, 1) : Easing.bezier(0.4, 0, 1, 1);
    const animation = Animated.parallel([
      Animated.timing(alpha, {
        toValue: expanded ? 1 : 0,
        duration: tooltip ? 150 : expanded ? 30 : 75,
        easing: tooltip ? easing : Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: expanded ? 1 : hiddenScale,
        duration: tooltip ? 150 : expanded ? 120 : 1,
        delay: !tooltip && !expanded ? 74 : 0,
        easing,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished && !expanded) setAnchor(null);
    });
    return () => animation.stop();
  }, [anchor, expanded, reducedMotion, alpha, scale, hiddenScale, tooltip]);
  const close = useCallback(() => {
    generation.current += 1;
    if (!active.current) return false;
    active.current = false;
    setExpanded(false);
    if (reducedMotion) setAnchor(null);
    return true;
  }, [reducedMotion]);
  const open = () => {
    if (!enabled || !focused) return;
    if (active.current) {
      close();
      return;
    }
    const request = ++generation.current;
    trigger.current?.measureInWindow((x, y, width, height) => {
      if (generation.current !== request) return;
      active.current = true;
      setExpanded(true);
      setAnchor(
        iconAnchor
          ? { x: x + (width - 16) / 2, y: y + (height - 16) / 2, width: 16, height: 16 }
          : { x, y, width, height },
      );
    });
  };
  return { trigger, anchor, expanded, active, open, close, alpha, scale, window, appearance };
}
