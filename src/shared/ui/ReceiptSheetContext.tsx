import { createContext, useContext } from 'react';

export const ReceiptSheetContext = createContext<{
  close: () => void;
  busy?: boolean;
  presentation?: 'sheet' | 'screen';
  headerInset?: number;
} | null>(null);
export const useReceiptSheet = () => useContext(ReceiptSheetContext);
