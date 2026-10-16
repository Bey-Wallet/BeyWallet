import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { detectLightningInputType, normalizeLightningInput } from '~/services/api/lnurlService';

export interface ConversationPaymentInput {
  value: string;
  type: string;
  route?: 'lightning' | 'onchain' | 'cashu_request' | 'cashu_token';
  error?: string;
}

/** Presentation only. The destination flow still validates and confirms every payment. */
export function conversationPaymentInput(text: string): ConversationPaymentInput | undefined {
  const raw = text.trim();
  const lightning = raw.replace(/^lightning:/i, '').trim();
  if (
    /^(lnurl1|lnurlp:\/\/)/i.test(lightning) ||
    detectLightningInputType(lightning) === 'address'
  ) {
    try {
      const value = normalizeLightningInput(lightning);
      if (!['address', 'lnurlp'].includes(detectLightningInputType(value)))
        throw new Error('Invalid Lightning payment');
      return {
        value,
        type: 'Lightning · LNURL',
        route: 'lightning',
      };
    } catch {
      return { value: raw, type: 'Lightning · LNURL', error: 'Invalid Lightning payment' };
    }
  }
  const parsed = parsePaymentInput(raw);
  if (!parsed.matched) return undefined;
  if (!parsed.ok) return { value: raw, type: 'Payment', error: parsed.reason };
  const { type, value } = parsed.value.primary;
  switch (type) {
    case 'lightning_invoice':
      return { value, type: 'Lightning · Invoice', route: 'lightning' };
    case 'bitcoin_onchain':
      return { value: raw, type: 'Bitcoin · On-chain', route: 'onchain' };
    case 'cashu_request':
      return { value, type: 'Ecash request', route: 'cashu_request' };
    case 'cashu_token':
      return { value, type: 'Ecash', route: 'cashu_token' };
    case 'bolt12_offer':
      return { value, type: 'Lightning · BOLT12', error: 'BOLT12 offers are not supported yet' };
  }
}
