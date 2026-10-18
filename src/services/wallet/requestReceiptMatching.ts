import type { NostrReceiveRequest } from '~/state/nostrRequestStore';
import type { NostrInboxItem } from '~/state/nostrInboxStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import { normalizePaymentMint } from './paymentRequestModel';

/** Match a response without treating delivery or spent proofs as receipt evidence. */
export function matchReceiveRequest(
  requests: NostrReceiveRequest[],
  item: NostrInboxItem,
): NostrReceiveRequest | undefined {
  if (item.type === 'request') return;
  if (item.receiptCreatedAt !== undefined && item.receiptCreatedAt < item.receivedAt) return;
  const matches = requests.filter((request) => {
    if (
      request.state !== 'pending' ||
      request.unit !== 'sat' ||
      (item.unit || 'sat') !== request.unit
    )
      return false;
    if (item.requestId && request.id !== item.requestId) return false;
    if (item.receiptCreatedAt !== undefined && item.receiptCreatedAt < request.createdAt)
      return false;
    if (request.recipient && normalizeNpub(request.recipient) !== normalizeNpub(item.senderPubkey))
      return false;
    try {
      // Explicit responses may include receiver input fees; ID-less legacy responses
      // require an exact amount and must match exactly one outstanding request.
      return (
        (item.requestId ? item.amount >= request.amount : item.amount === request.amount) &&
        normalizePaymentMint(request.mintUrl) === normalizePaymentMint(item.mintUrl)
      );
    } catch {
      return false;
    }
  });
  return matches.length === 1 ? matches[0] : undefined;
}
