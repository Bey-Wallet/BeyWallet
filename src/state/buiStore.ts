import { create } from 'zustand';

export type BUIAppearance = 'light' | 'dark';
// Preview preference only. Does not change the wallet's saved appearance.
export const useBUIStore = create<{
  appearance: BUIAppearance;
  setAppearance: (appearance: BUIAppearance) => void;
}>((set) => ({
  appearance: 'dark',
  setAppearance: (appearance) => set({ appearance }),
}));
