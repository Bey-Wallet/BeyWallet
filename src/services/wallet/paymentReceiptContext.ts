import type { ReceiptEntry, ReceiptSnapshot } from '~/features/history/receiptDetails';
import { readLightningReceiptSnapshot } from './lightningReceiptContext';

export interface PaymentReceiptIdentity {
  wallet?: string | null;
  mintUrl: string;
  type: string;
  operationId?: string;
  quoteId?: string;
}

type SavedHistory = ReceiptEntry & { metadata: string | null };
type SavedOperation = {
  id: string;
  state: string;
  quoteId?: string;
  amount?: number;
  fee_reserve?: number;
  swap_fee?: number;
};
const metadataKeys = [
  'via',
  'fee',
  'actualFee',
  'feeReserve',
  'operationState',
  'submitted',
  'recipient',
  'lnAddress',
  'nostrUsername',
  'nostrPubkey',
  'description',
  'transferId',
  'address',
  'txid',
  'requestId',
];

/** Only exact local references are read. No tokens/proofs/outputs are selected. */
export async function readPaymentReceiptContext(identity: PaymentReceiptIdentity): Promise<{
  entry?: ReceiptEntry;
  snapshot: ReceiptSnapshot;
}> {
  let entry: ReceiptEntry | undefined;
  let operation: SavedOperation | undefined;
  try {
    const { initService } = require('./initService') as typeof import('./initService');
    const db = initService.getRepo().db;
    const mint = identity.mintUrl.replace(/\/+$/, '');
    if (identity.operationId || identity.quoteId) {
      const reference = identity.operationId ? 'operationId' : 'quoteId';
      const row = await db.get<SavedHistory>(
        `SELECT id, type, amount, unit, mintUrl, createdAt, state, quoteId, operationId, paymentRequest, metadata
         FROM coco_cashu_history WHERE (mintUrl = ? OR mintUrl = ?) AND type = ? AND ${reference} = ?
         ORDER BY id DESC LIMIT 1`,
        [mint, `${mint}/`, identity.type, identity.operationId || identity.quoteId!],
      );
      if (row) {
        let metadata: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(row.metadata || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const key of metadataKeys)
              if (['string', 'number', 'boolean'].includes(typeof parsed[key]))
                metadata[key] = parsed[key];
          }
        } catch {
          /* Optional annotations must not prevent reading the receipt. */
        }
        entry = {
          id: String(row.id),
          type: row.type,
          amount: row.amount,
          unit: row.unit,
          mintUrl: row.mintUrl,
          createdAt: row.createdAt,
          state: row.state,
          quoteId: row.quoteId || undefined,
          operationId: row.operationId || undefined,
          paymentRequest: row.paymentRequest || undefined,
          metadata,
        };
      }
    }
    if (
      identity.type === 'melt' &&
      (identity.operationId || entry?.operationId || identity.quoteId)
    ) {
      const operationId = identity.operationId || entry?.operationId;
      operation =
        (await db.get<SavedOperation>(
          `SELECT id, state, quoteId, amount, fee_reserve, swap_fee FROM coco_cashu_melt_operations
         WHERE (mintUrl = ? OR mintUrl = ?) AND ${operationId ? 'id' : 'quoteId'} = ? LIMIT 1`,
          [mint, `${mint}/`, operationId || identity.quoteId!],
        )) ?? undefined;
    }
  } catch {
    /* Saved receipt data can be unavailable during wallet shutdown. */
  }
  const quoteId = identity.quoteId || entry?.quoteId || operation?.quoteId;
  const snapshot: ReceiptSnapshot =
    quoteId && ['mint', 'melt'].includes(identity.type)
      ? await readLightningReceiptSnapshot(
          identity.wallet,
          entry?.mintUrl || identity.mintUrl,
          quoteId,
          identity.type === 'mint',
        )
      : {};
  // Operation state and quote state are distinct. Never infer settlement from preparation.
  return {
    entry,
    snapshot: {
      ...snapshot,
      quoteId,
      operationId: operation?.id || identity.operationId || entry?.operationId,
      operationState: operation?.state,
      amount: snapshot.amount ?? operation?.amount,
      fee_reserve: snapshot.fee_reserve ?? operation?.fee_reserve,
      swapFee: operation?.swap_fee,
    },
  };
}
