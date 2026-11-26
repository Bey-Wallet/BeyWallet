import { createContext } from 'react';

/** Scoped to one action menu; no payment data or callbacks cross screens. */
export const TechnicalDetailsMenuContext = createContext<{
  open: boolean;
  close: () => void;
} | null>(null);
