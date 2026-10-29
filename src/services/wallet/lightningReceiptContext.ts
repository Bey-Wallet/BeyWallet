import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export interface LightningReceiptSnapshot {
  recipient?: string;
  request?: string;
  expiry?: number;
  state?: string;
  amount?: number;
  fee_reserve?: number;
  payment_preimage?: string | null;
}

/** Read local snapshots only. Signing keys and proof inputs are never returned. */
export async function readLightningReceiptSnapshot(
  wallet: string | null | undefined,
  mint: string,
  quote: string,
  incoming: boolean,
): Promise<LightningReceiptSnapshot> {
  const recipient = readLightningRecipient(wallet, mint, quote);
  try {
    const { initService } = require('./initService') as typeof import('./initService');
    const repo = initService.getRepo();
    const saved = incoming
      ? await repo.mintQuoteRepository.getMintQuote(mint, quote)
      : await repo.meltQuoteRepository.getMeltQuote(mint, quote);
    return {
      recipient,
      request: saved?.request,
      expiry: saved?.expiry,
      state: saved?.state,
      amount: saved?.amount,
      fee_reserve: saved && 'fee_reserve' in saved ? saved.fee_reserve : undefined,
      payment_preimage: saved && 'payment_preimage' in saved ? saved.payment_preimage : undefined,
    };
  } catch {
    return { recipient };
  }
}

const key = (wallet: string, mint: string, quote: string) =>
  `lightning-receipt:${JSON.stringify([wallet, mint.replace(/\/+$/, ''), quote])}`;

export function removeLightningRecipient(
  wallet: string | null | undefined,
  mint: string,
  quote?: string,
) {
  if (!wallet || !quote) return;
  try {
    sqliteStorage.removeItem(key(wallet, mint, quote));
  } catch {
    /* Best-effort local annotation cleanup. */
  }
}

/** Optional local receipt annotation; never part of payment execution or success evidence. */
export function saveLightningRecipient(
  wallet: string | null | undefined,
  mint: string,
  quote: string,
  recipient: string | null,
) {
  if (!wallet || !recipient || recipient.length > 500) return;
  try {
    sqliteStorage.setItem(key(wallet, mint, quote), JSON.stringify({ recipient }));
  } catch {
    /* Receipt annotation must never interrupt a submitted payment. */
  }
}
export function readLightningRecipient(
  wallet: string | null | undefined,
  mint: string,
  quote?: string,
) {
  if (!wallet || !quote) return undefined;
  try {
    const value = JSON.parse(sqliteStorage.getItem(key(wallet, mint, quote)) || '{}');
    return typeof value.recipient === 'string' && value.recipient.length <= 500
      ? value.recipient
      : undefined;
  } catch {
    return undefined;
  }
}
