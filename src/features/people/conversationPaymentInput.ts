import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { detectLightningInputType, normalizeLightningInput } from '~/services/api/lnurlService';
import { bech32 } from 'bech32';

export interface ConversationPaymentInput {
  value: string;
  type: string;
  route?: 'lightning' | 'onchain' | 'cashu_request' | 'cashu_token';
  error?: string;
  amount?: number;
}

/** Presentation only. The destination flow still validates and confirms every payment. */
function parseConversationPaymentInput(text: string): ConversationPaymentInput | undefined {
  const raw = text.trim();
  const lightning = raw.replace(/^lightning:/i, '').trim();
  const lightningAddress = detectLightningInputType(lightning) === 'address';
  if (/^(lnurl1|lnurlp:\/\/)/i.test(lightning) || lightningAddress) {
    try {
      const value = normalizeLightningInput(lightning);
      if (!['address', 'lnurlp'].includes(detectLightningInputType(value)))
        throw new Error('Invalid Lightning payment');
      return {
        value,
        type: lightningAddress ? 'Lightning · Address' : 'Lightning · LNURL',
        route: 'lightning',
      };
    } catch {
      return { value: raw, type: 'Lightning · LNURL', error: 'Invalid Lightning payment' };
    }
  }
  const parsed = parsePaymentInput(raw);
  if (!parsed.matched) return undefined;
  if (!parsed.ok) {
    const unwrapped = raw.replace(/^(?:web\+cashu:\/\/|web\+cashu:|cashu:|lightning:)/i, '').trim();
    const type = /^creq[ab]/i.test(unwrapped)
      ? 'Ecash request'
      : /^cashu[ab]/i.test(unwrapped)
        ? 'Ecash'
        : /^bitcoin:/i.test(raw)
          ? 'Bitcoin · On-chain'
          : 'Payment';
    return { value: raw, type, error: parsed.reason };
  }
  const { type, value } = parsed.value.primary;
  switch (type) {
    case 'lightning_invoice':
      return {
        value,
        type: 'Lightning · Invoice',
        route: 'lightning',
        amount: invoiceAmount(value),
      };
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

/** Extract standalone or sentence-embedded payment details without executing them. */
export function conversationPaymentParts(text: string): {
  inputs: ConversationPaymentInput[];
  note?: string;
} {
  const inputs: ConversationPaymentInput[] = [];
  const context: string[] = [];
  let end = 0;
  // Keep URI query strings intact; trim surrounding prose punctuation only.
  const pieces = [...text.matchAll(/\S+/g)];
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    let token = piece[0];
    let tokenEnd = piece.index! + token.length;
    if (/^(?:lightning|cashu|web\+cashu|bitcoin):(?:\/\/)?$/i.test(token) && pieces[index + 1]) {
      const next = pieces[++index];
      token += next[0];
      tokenEnd = next.index! + next[0].length;
    }
    const candidate = token.replace(/^[([{<"'`]+/, '').replace(/[)\]}>"'`.,;!]+$/, '');
    const input = parseConversationPaymentInput(candidate);
    if (!input) continue;
    inputs.push(input);
    context.push(text.slice(end, piece.index));
    end = tokenEnd;
  }
  if (!inputs.length) return { inputs };
  context.push(text.slice(end));
  const note = context.join(' ').replace(/\s+/g, ' ').trim();
  return { inputs, note: note || undefined };
}

export function conversationPaymentInput(text: string): ConversationPaymentInput | undefined {
  return conversationPaymentParts(text).inputs[0];
}

// Display only. Payment validation and confirmation remain in the Lightning flow.
function invoiceAmount(invoice: string): number | undefined {
  try {
    const { prefix } = bech32.decode(invoice, 32000);
    const match = /^ln(?:bc|tb|bcrt)(\d+)([munp]?)$/.exec(prefix);
    if (!match) return undefined;
    const scales: Record<string, bigint> = {
      '': 1000000000000n,
      m: 1000000000n,
      u: 1000000n,
      n: 1000n,
      p: 1n,
    };
    const value = BigInt(match[1]) * scales[match[2]];
    if (value % 10000n !== 0n) return undefined;
    const sats = Number(value / 10000n);
    return Number.isSafeInteger(sats) && sats > 0 ? sats : undefined;
  } catch {
    return undefined;
  }
}
