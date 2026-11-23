import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import {
  buildReceiptDetails,
  type ReceiptEntry,
  type ReceiptSnapshot,
} from '~/features/history/receiptDetails';
import { readPaymentReceiptContext } from '~/services/wallet/paymentReceiptContext';
import { historyMetadata } from '~/features/history/transactionPresentation';

/** The same allowlisted model serves live payments and saved History receipts. */
export function usePaymentTechnicalDetails(entry: ReceiptEntry, snapshot: ReceiptSnapshot = {}) {
  const wallet = useSettingsStore((state) => state.npub);
  const { data } = useQuery({
    queryKey: [
      'history',
      'technicalDetails',
      wallet,
      entry.mintUrl,
      entry.type,
      entry.operationId,
      entry.quoteId,
      entry.state,
    ],
    enabled: !!wallet && !!entry.mintUrl && !!(entry.operationId || entry.quoteId),
    networkMode: 'always',
    retry: false,
    queryFn: () =>
      readPaymentReceiptContext({
        wallet,
        mintUrl: entry.mintUrl,
        type: entry.type,
        operationId: entry.operationId,
        quoteId: entry.quoteId,
      }),
  });
  const saved = data?.entry;
  const savedSnapshot = Object.fromEntries(
    Object.entries(data?.snapshot || {}).filter(([, value]) => value !== undefined),
  );
  // If present, persisted identifiers, dates, amounts and status are authoritative.
  // Display hints fill gaps; a missing transaction ID/date is never fabricated.
  return buildReceiptDetails(
    {
      ...entry,
      ...saved,
      metadata: {
        ...historyMetadata(entry),
        ...(saved ? historyMetadata(saved) : {}),
      },
      paymentRequest: saved?.paymentRequest || entry.paymentRequest,
    },
    { ...snapshot, ...savedSnapshot },
  );
}
