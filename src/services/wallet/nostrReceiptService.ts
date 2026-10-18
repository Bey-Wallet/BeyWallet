import { getTokenMetadata } from '@cashu/cashu-ts';
import type { ReceiveHistoryEntry } from 'coco-cashu-core';
import type { NostrInboxItem, NostrClaimFailure } from '~/state/nostrInboxStore';
import { normalizePaymentMint } from './paymentRequestModel';

const proofKey = (proof: { amount: number; C: string; secret: string }) =>
  JSON.stringify([proof.amount, proof.C, proof.secret]);

export const unverifiedReceiptFailure: NostrClaimFailure = {
  code: 'receipt_unverified',
  message:
    'Receipt unverified. No matching successful receive is recorded in this wallet. Check History or contact the sender.',
  retryable: false,
};

/** History stores the original inputs only after Coco saves the newly redeemed proofs. */
export function matchesReceiveReceipt(token: string, entry: ReceiveHistoryEntry): boolean {
  try {
    const metadata = getTokenMetadata(token);
    if (
      entry.type !== 'receive' ||
      (entry as { state?: string | null }).state != null ||
      !entry.token ||
      normalizePaymentMint(entry.mintUrl) !== normalizePaymentMint(metadata.mint) ||
      normalizePaymentMint(entry.token.mint) !== normalizePaymentMint(metadata.mint) ||
      entry.unit !== metadata.unit ||
      entry.amount !== metadata.amount
    )
      return false;
    const input = metadata.incompleteProofs.map(proofKey).sort();
    const recorded = entry.token.proofs.map(proofKey).sort();
    return (
      input.length > 0 &&
      input.length === recorded.length &&
      new Set(input).size === input.length &&
      input.every((proof, index) => proof === recorded[index])
    );
  } catch {
    return false;
  }
}

export async function findReceiveReceipt(
  item: NostrInboxItem,
): Promise<ReceiveHistoryEntry | undefined> {
  const metadata = getTokenMetadata(item.tokenString);
  if (
    metadata.amount !== item.amount ||
    metadata.unit !== (item.unit || 'sat') ||
    normalizePaymentMint(metadata.mint) !== normalizePaymentMint(item.mintUrl)
  )
    return;
  const receipt = await findTokenReceiveReceipt(item.tokenString);
  const requestId = (receipt?.metadata as Record<string, unknown> | undefined)?.requestId;
  if (requestId && requestId !== item.requestId) return;
  return receipt;
}

export async function findTokenReceiveReceipt(
  token: string,
): Promise<ReceiveHistoryEntry | undefined> {
  const metadata = getTokenMetadata(token);
  const { initService } = require('./initService') as typeof import('./initService');
  const candidates = await initService
    .getRepo()
    .historyRepository.getSuccessfulReceiveCandidates(metadata.amount, metadata.unit);
  return candidates.find((entry) => matchesReceiveReceipt(token, entry));
}
