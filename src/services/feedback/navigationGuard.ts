const blockers = new Set<symbol>();
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
export const feedbackNavigationGuard = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => blockers.size > 0,
  get blocked() {
    return blockers.size > 0;
  },
  acquire() {
    const token = Symbol();
    blockers.add(token);
    notify();
    return () => {
      if (blockers.delete(token)) notify();
    };
  },
};
