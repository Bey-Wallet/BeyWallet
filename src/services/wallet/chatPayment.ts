import { PaymentRequest } from '@cashu/cashu-ts';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { decodeToken } from './tokenUtils';
import { normalizePaymentMint } from './paymentRequestModel';

export interface SharedChatPayment {
  encoded: string;
  type: 'token' | 'request';
  amount: number;
  note?: string;
  requestId?: string;
}

/** Inspect an existing payment for sharing; never creates or redeems funds. */
export function inspectChatPayment(text: string): SharedChatPayment {
  const parsed = parsePaymentInput(text);
  if (!parsed.matched || !parsed.ok) throw new Error('Paste a valid ecash token or request.');
  const { type, value } = parsed.value.primary;
  if (type === 'cashu_request') {
    const request = PaymentRequest.fromEncodedRequest(value);
    if (!Number.isSafeInteger(request.amount) || request.amount! <= 0 || request.unit !== 'sat')
      throw new Error('Only requests with a positive whole sat amount can be shared.');
    for (const mint of request.mints ?? []) normalizePaymentMint(mint);
    return {
      encoded: value,
      type: 'request',
      amount: request.amount!,
      requestId: request.id,
      note: typeof request.description === 'string' ? request.description : undefined,
    };
  }
  if (type !== 'cashu_token') throw new Error('Paste a valid ecash token or request.');
  const token = decodeToken(value);
  normalizePaymentMint(token.mint);
  if (
    token.unit !== 'sat' ||
    !Number.isSafeInteger(token.amount) ||
    token.amount <= 0 ||
    !token.proofs.length ||
    token.proofs.some(
      (proof) =>
        !Number.isSafeInteger(proof.amount) ||
        proof.amount <= 0 ||
        typeof proof.secret !== 'string' ||
        !proof.secret ||
        typeof proof.C !== 'string' ||
        !proof.C,
    )
  )
    throw new Error('Invalid ecash token. Only whole sat amounts can be shared.');
  return { encoded: value, type: 'token', amount: token.amount, note: token.memo };
}
