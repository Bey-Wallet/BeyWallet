import { decodeToken } from '~/services/wallet/tokenUtils';
import { getHistoryToken } from './historyToken';
import { historyMetadata } from './transactionPresentation';

export interface TransactionNote {
  label: string;
  value: string;
}

/** Display saved text and the token's memo without repeating the same attachment. */
export function getTransactionNotes(entry: {
  type: string;
  mintUrl: string;
  metadata?: unknown;
  token?: unknown;
}): TransactionNote[] {
  const metadata = historyMetadata(entry);
  const notes: TransactionNote[] = [];
  const seen = new Set<string>();
  const append = (label: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || seen.has(value.trim())) return;
    seen.add(value.trim());
    notes.push({ label, value: value.trim() });
  };
  append('Note', metadata.note);
  append('Memo', metadata.memo);
  append('Message', metadata.message);
  append('Message', metadata.msg);
  append('Description', metadata.description);
  const token = getHistoryToken(entry);
  if (token) {
    try {
      append('Memo', decodeToken(token).memo);
    } catch {
      // Saved text remains available even when a token cannot be read.
    }
  }
  return notes;
}
