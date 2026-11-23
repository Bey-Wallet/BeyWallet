import type { MeltOperation } from 'coco-cashu-core';
import type { ExpoSqliteDb } from '../db';
import { bech32 } from 'bech32';

export const hiddenMeltHistoryKey = (mint: string, operation: string) =>
  `hidden-lightning-attempt:${JSON.stringify([mint, operation])}`;

/** Display estimate only; the mint's prepared amount remains authoritative for payment. */
function invoiceAmount(invoice: string): number {
  try {
    const { prefix } = bech32.decode(invoice, 20000);
    const match = /^ln(?:bc|tb|tbs|bcrt)(\d+)([munp]?)$/.exec(prefix);
    if (!match) return 0;
    const scale: Record<string, bigint> = {
      '': 1000000000000n,
      m: 1000000000n,
      u: 1000000n,
      n: 1000n,
      p: 1n,
    };
    const amount = Number((BigInt(match[1]) * scale[match[2]] + 9999n) / 10000n);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
  } catch {
    return 0;
  }
}

type Attempt = Pick<
  MeltOperation,
  'id' | 'mintUrl' | 'method' | 'methodData' | 'state' | 'createdAt'
> & {
  quoteId?: string;
  amount?: number;
  fee_reserve?: number;
  swap_fee?: number;
  error?: string;
};

/** Receipt projection only. Never serialize an operation's proofs, outputs or signing material. */
export async function projectMeltHistory(
  db: ExpoSqliteDb,
  operation: Attempt,
  preparationFailed = false,
) {
  if (operation.method !== 'bolt11') return;
  const invoice = (operation.methodData as { invoice?: unknown } | null)?.invoice;
  if (typeof invoice !== 'string' || !invoice) return;
  if (
    await db.get('SELECT value FROM coco_cashu_settings WHERE key = ?', [
      hiddenMeltHistoryKey(operation.mintUrl, operation.id),
    ])
  )
    return;
  const old = await db.get<{ id: number; state: string | null; metadata: string | null }>(
    `SELECT id, state, metadata FROM coco_cashu_history WHERE type = 'melt' AND mintUrl = ?
      AND (operationId = ? OR (? IS NOT NULL AND quoteId = ?))
      ORDER BY CASE WHEN operationId = ? THEN 0 ELSE 1 END, id DESC LIMIT 1`,
    [
      operation.mintUrl,
      operation.id,
      operation.quoteId ?? null,
      operation.quoteId ?? null,
      operation.id,
    ],
  );
  let previous: Record<string, unknown> = {};
  try {
    const parsed: unknown = old?.metadata ? JSON.parse(old.metadata) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      previous = parsed as Record<string, unknown>;
  } catch {
    /* Keep the receipt usable. */
  }
  const submitted =
    previous.submitted === true ||
    ['executing', 'pending', 'finalized'].includes(operation.state) ||
    (previous.submitted !== false && ['rolling_back', 'rolled_back'].includes(operation.state));
  const state = preparationFailed
    ? 'failed'
    : operation.state === 'finalized'
      ? 'PAID'
      : operation.state === 'rolled_back'
        ? submitted || operation.error === 'Bey: preparation failed'
          ? 'failed'
          : 'cancelled'
        : operation.state === 'rolling_back'
          ? 'unresolved'
          : operation.state === 'init'
            ? 'preparing'
            : operation.state === 'prepared'
              ? 'prepared'
              : 'pending';
  // A confirmed receipt must never be downgraded by a late preparation/cleanup observation.
  if (old?.state?.toLowerCase() === 'paid' && state !== 'PAID') return;
  const metadata = JSON.stringify({
    ...previous,
    paymentAttempt: true,
    submitted,
    operationState: operation.state,
    ...(operation.fee_reserve != null && operation.swap_fee != null
      ? { feeReserve: operation.fee_reserve + operation.swap_fee }
      : {}),
  });
  const amount =
    Number.isSafeInteger(operation.amount) && operation.amount! >= 0
      ? operation.amount!
      : invoiceAmount(invoice);
  if (old) {
    await db.run(
      `UPDATE coco_cashu_history SET state = ?, amount = ?, quoteId = COALESCE(?, quoteId),
      operationId = ?, paymentRequest = ?, metadata = ? WHERE id = ?`,
      [state, amount, operation.quoteId ?? null, operation.id, invoice, metadata, old.id],
    );
  } else {
    await db.run(
      `INSERT INTO coco_cashu_history
      (mintUrl, type, unit, amount, createdAt, state, quoteId, operationId, paymentRequest, metadata)
      VALUES (?, 'melt', 'sat', ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.mintUrl,
        amount,
        operation.createdAt,
        state,
        operation.quoteId ?? null,
        operation.id,
        invoice,
        metadata,
      ],
    );
  }
}
