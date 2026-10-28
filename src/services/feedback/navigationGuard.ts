const blockers = new Set<symbol>();
export const feedbackNavigationGuard = {
  get blocked() {
    return blockers.size > 0;
  },
  acquire() {
    const token = Symbol();
    blockers.add(token);
    return () => {
      blockers.delete(token);
    };
  },
};
