export type AppShortcutAction = 'scan' | 'receive';
type Shortcut = { id: number; action: AppShortcutAction };
let pending: Shortcut | null = null;
let sequence = 0;
const listeners = new Set<() => void>();

/** Public action names only. Never accept amounts, tokens, or arbitrary routes from a shortcut. */
export function queueAppShortcut(path: string): boolean {
  const match = /^bey-wallet:\/\/\/shortcut\/(scan|receive)$/.exec(path);
  if (!match) return false;
  pending = { id: ++sequence, action: match[1] as AppShortcutAction };
  for (const listener of listeners) listener();
  return true;
}

export const appShortcuts = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => pending,
  consume(id: number): boolean {
    if (pending?.id !== id) return false;
    pending = null;
    for (const listener of listeners) listener();
    return true;
  },
};
