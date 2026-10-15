import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  // Stay still until the device preference has been read.
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      receivedEvent = true;
      setReducedMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !receivedEvent) setReducedMotion(value);
      },
      () => {},
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reducedMotion;
}
