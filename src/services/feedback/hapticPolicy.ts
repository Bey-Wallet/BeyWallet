export type HapticIntent =
  'selection' | 'keypad' | 'acknowledge' | 'completion' | 'review' | 'reject';
export interface HapticState {
  ready: boolean;
  enabled: boolean;
  foreground: boolean;
  unlocked: boolean;
  reducedMotion: boolean;
}

/** No queue or timers: suppressed feedback is discarded and never replayed. */
export class HapticPolicy {
  private lastTick = -Infinity;

  constructor(
    private readonly state: () => HapticState,
    private readonly play: (intent: HapticIntent) => void | Promise<void>,
    private readonly now: () => number = Date.now,
  ) {}

  emit(intent: HapticIntent) {
    try {
      const state = this.state();
      if (!state.ready || !state.enabled || !state.foreground || !state.unlocked) return;
      const optional = intent === 'selection' || intent === 'keypad' || intent === 'acknowledge';
      if (optional && state.reducedMotion) return;
      const time = this.now();
      if (optional) {
        if (time - this.lastTick < (intent === 'keypad' ? 60 : 100)) return;
        this.lastTick = time;
      }
      void Promise.resolve(this.play(intent)).catch(() => {});
    } catch {
      // Native feedback must never interrupt input, persistence or a payment.
    }
  }
}
