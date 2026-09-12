import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  hasBackgrounded: boolean; // Track if app has ever gone to background
  isLockDisabled: boolean; // Track if auto-lock should be temporarily disabled
  setAuthenticated: (value: boolean) => void;
  lock: (force?: boolean) => void;
  markBackgrounded: () => void;
  setLockDisabled: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false, // Lock on cold start
  hasBackgrounded: false, // Track if we've gone to background
  isLockDisabled: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  lock: (force = false) => {
    // Prevent automatic lock if temporarily disabled
    if (!force && get().isLockDisabled) return;

    // Lock if forced (manual) or if app has backgrounded before
    if (force || get().hasBackgrounded) {
      set({ isAuthenticated: false });
    }
  },
  markBackgrounded: () => set({ hasBackgrounded: true }),
  setLockDisabled: (value) => set({ isLockDisabled: value }),
}));
