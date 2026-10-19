import { create } from 'zustand';

/** Transient public-key scans; never feed these into the general payment scanner result. */
export const useP2PKScanStore = create<{
  result: { id: string; value: string } | null;
  setResult: (result: { id: string; value: string } | null) => void;
}>((set) => ({ result: null, setResult: (result) => set({ result }) }));
