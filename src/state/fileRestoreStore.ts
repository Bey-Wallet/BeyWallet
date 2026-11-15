import { create } from 'zustand';

export interface FileRestorePreview {
  balance: number;
  pendingBalance: number;
  mints: { mintUrl: string; name: string; balance: number; pendingBalance: number }[];
}

/** Presentation only. Seeds and restore records stay outside React state. */
export const useFileRestoreStore = create<{
  phase:
    'checking' | 'idle' | 'preparing' | 'ready' | 'installing' | 'restart' | 'error' | 'success';
  mode: 'merge' | 'replace' | 'new' | null;
  error: string | null;
  preview: FileRestorePreview | null;
}>(() => ({ phase: 'checking', mode: null, error: null, preview: null }));
