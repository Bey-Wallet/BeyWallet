import type { FeedbackTarget } from './feedbackCoordinator';

export function isFeedbackTarget(value: unknown): value is FeedbackTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  if (target.type === 'history' || target.type === 'recovery') return true;
  return (
    ['transaction', 'conversation', 'incoming'].includes(String(target.type)) &&
    typeof target.id === 'string' &&
    target.id.length > 0 &&
    target.id.length <= 200
  );
}

/** Repeated warm/cold callbacks share one queue. It can only carry opaque references. */
export class NotificationResponseQueue {
  private consumed = new Set<string>();
  private pending: string[] = [];
  enqueue(value: unknown) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value) || this.consumed.has(value))
      return;
    this.consumed.add(value);
    this.pending.push(value);
  }
  take(ready: boolean) {
    return ready ? this.pending.shift() : undefined;
  }
  defer(id: string) {
    if (!this.pending.includes(id)) this.pending.unshift(id);
  }
  clear() {
    this.pending = [];
    this.consumed.clear();
  }
}
