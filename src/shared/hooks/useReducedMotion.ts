import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

const listeners = new Set<() => void>();
let reducedMotion = true;
let generation = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;

function update(value: boolean) {
  if (reducedMotion === value) return;
  reducedMotion = value;
  [...listeners].forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const currentGeneration = ++generation;
    let receivedEvent = false;
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (generation !== currentGeneration) return;
      receivedEvent = true;
      update(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (generation === currentGeneration && !receivedEvent) update(value);
      },
      () => {},
    );
  }
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return;
    generation++;
    subscription?.remove();
    subscription = undefined;
    // A later mount must re-read a preference that may have changed while idle.
    reducedMotion = true;
  };
}

const getSnapshot = () => reducedMotion;
const getServerSnapshot = () => true;

/** Share native preference work across controls; stay still until the first read completes. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
