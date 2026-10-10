import type { PaymentRequestPayload, Token } from '@cashu/cashu-ts';

interface PaymentRequestPayloadOptions {
  id?: string;
  memo?: string;
  unit: string;
}

/**
 * Build a NUT-18 payload from the original token object returned by the send operation.
 *
 * Do not serialize and decode the token before calling this function: compact V4 encoding can
 * require keyset context during decoding and is an unnecessary, lossy delivery boundary.
 */
export function createPaymentRequestPayload(
  token: Token,
  options: PaymentRequestPayloadOptions,
): PaymentRequestPayload {
  if (!token.mint?.trim()) {
    throw new Error('Cannot deliver payment request without a token mint');
  }
  if (!Array.isArray(token.proofs) || token.proofs.length === 0) {
    throw new Error('Cannot deliver payment request without token proofs');
  }
  if (!options.unit?.trim()) {
    throw new Error('Cannot deliver payment request without a unit');
  }

  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.memo ? { memo: options.memo } : {}),
    mint: token.mint,
    unit: options.unit,
    proofs: token.proofs,
  };
}
