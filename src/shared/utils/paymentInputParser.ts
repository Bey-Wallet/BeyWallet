import { PaymentRequest } from '@cashu/cashu-ts';

const MAX_PAYMENT_INPUT_LENGTH = 32_000;

export type PaymentAlternative =
  | { type: 'cashu_token'; value: string }
  | { type: 'cashu_request'; value: string }
  | { type: 'lightning_invoice'; value: string }
  | { type: 'bolt12_offer'; value: string }
  | { type: 'bitcoin_onchain'; value: string };

export interface ParsedPaymentInput {
  raw: string;
  normalized: string;
  primary: PaymentAlternative;
  alternatives: PaymentAlternative[];
  source: 'bare' | 'cashu_uri' | 'bitcoin_uri' | 'lightning_uri';
}

export type PaymentInputParseResult =
  | { matched: false }
  | { matched: true; ok: false; reason: string }
  | { matched: true; ok: true; value: ParsedPaymentInput };

const BITCOIN_ADDRESS_PATTERN = /^(1|3|bc1[qzp]|tb1[qzp])[a-zA-HJ-NP-Z0-9]{25,90}$/i;

function isCashuToken(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('cashua') || lower.startsWith('cashub');
}

function isCashuRequest(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('creqa') || lower.startsWith('creqb');
}

function validateCashuRequest(value: string): string | null {
  if (!isCashuRequest(value)) return 'Invalid Cashu payment request';

  try {
    PaymentRequest.fromEncodedRequest(value);
    return null;
  } catch {
    return 'Invalid Cashu payment request';
  }
}

function isLightningInvoice(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('lnbc') || lower.startsWith('lntb') || lower.startsWith('lnbcrt');
}

function isBolt12Offer(value: string): boolean {
  return value.toLowerCase().startsWith('lno1');
}

function isBitcoinAddress(value: string): boolean {
  return BITCOIN_ADDRESS_PATTERN.test(value);
}

function success(
  raw: string,
  source: ParsedPaymentInput['source'],
  alternatives: PaymentAlternative[],
): PaymentInputParseResult {
  const primary = alternatives[0];
  return {
    matched: true,
    ok: true,
    value: {
      raw,
      normalized: primary.value,
      primary,
      alternatives,
      source,
    },
  };
}

function decodeQueryComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function parseBitcoinUri(raw: string, input: string): PaymentInputParseResult {
  const body = input.slice(input.indexOf(':') + 1);
  const queryIndex = body.indexOf('?');
  const rawAddress = queryIndex === -1 ? body : body.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? '' : body.slice(queryIndex + 1);

  let address: string;
  try {
    address = decodeQueryComponent(rawAddress.replace(/^\/\//, '')).trim();
  } catch {
    return { matched: true, ok: false, reason: 'Malformed Bitcoin URI encoding' };
  }

  const params = new Map<string, string[]>();
  if (rawQuery) {
    for (const entry of rawQuery.split('&')) {
      if (!entry) continue;
      const separator = entry.indexOf('=');
      const rawKey = separator === -1 ? entry : entry.slice(0, separator);
      const rawValue = separator === -1 ? '' : entry.slice(separator + 1);

      let key: string;
      let value: string;
      try {
        key = decodeQueryComponent(rawKey).toLowerCase();
        value = decodeQueryComponent(rawValue).trim();
      } catch {
        return { matched: true, ok: false, reason: 'Malformed Bitcoin URI encoding' };
      }

      if (key.startsWith('req-')) {
        return {
          matched: true,
          ok: false,
          reason: `Unsupported required Bitcoin URI parameter: ${key}`,
        };
      }

      const values = params.get(key) ?? [];
      values.push(value);
      params.set(key, values);
    }
  }

  for (const key of ['creq', 'lightning', 'lno']) {
    const values = params.get(key);
    if (values && new Set(values).size > 1) {
      return { matched: true, ok: false, reason: `Ambiguous duplicate ${key} parameter` };
    }
  }

  const creq = params.get('creq')?.[0];
  const lightning = params.get('lightning')?.[0];
  const lno = params.get('lno')?.[0];
  const alternatives: PaymentAlternative[] = [];

  if (creq !== undefined) {
    const error = validateCashuRequest(creq);
    if (error) return { matched: true, ok: false, reason: error };
    alternatives.push({ type: 'cashu_request', value: creq });
  }

  if (lightning !== undefined) {
    if (!isLightningInvoice(lightning)) {
      return { matched: true, ok: false, reason: 'Invalid Lightning invoice' };
    }
    alternatives.push({ type: 'lightning_invoice', value: lightning });
  }

  if (lno !== undefined) {
    if (!isBolt12Offer(lno)) {
      return { matched: true, ok: false, reason: 'Invalid BOLT12 offer' };
    }
    alternatives.push({ type: 'bolt12_offer', value: lno });
  }

  if (address) {
    if (!isBitcoinAddress(address)) {
      return { matched: true, ok: false, reason: 'Invalid Bitcoin address' };
    }
    alternatives.push({ type: 'bitcoin_onchain', value: address });
  }

  if (alternatives.length === 0) {
    return { matched: true, ok: false, reason: 'Bitcoin URI has no supported payment method' };
  }

  return success(raw, 'bitcoin_uri', alternatives);
}

export function parsePaymentInput(rawInput: string): PaymentInputParseResult {
  const input = rawInput.trim();
  if (!input) return { matched: false };

  if (input.length > MAX_PAYMENT_INPUT_LENGTH) {
    return { matched: true, ok: false, reason: 'Payment input is too large' };
  }

  const lower = input.toLowerCase();
  if (lower.startsWith('bitcoin:')) return parseBitcoinUri(rawInput, input);

  let value = input;
  let source: ParsedPaymentInput['source'] = 'bare';

  if (lower.startsWith('web+cashu://')) {
    value = input.slice(12);
    source = 'cashu_uri';
  } else if (lower.startsWith('web+cashu:')) {
    value = input.slice(10);
    source = 'cashu_uri';
  } else if (lower.startsWith('cashu:')) {
    value = input.slice(6);
    source = 'cashu_uri';
  } else if (lower.startsWith('lightning:')) {
    value = input.slice(10);
    source = 'lightning_uri';
  }

  value = value.trim();

  if (isCashuToken(value)) {
    return success(rawInput, source, [{ type: 'cashu_token', value }]);
  }

  if (isCashuRequest(value)) {
    const error = validateCashuRequest(value);
    if (error) return { matched: true, ok: false, reason: error };
    return success(rawInput, source, [{ type: 'cashu_request', value }]);
  }

  if (isLightningInvoice(value)) {
    return success(rawInput, source, [{ type: 'lightning_invoice', value }]);
  }

  if (isBolt12Offer(value)) {
    return success(rawInput, source, [{ type: 'bolt12_offer', value }]);
  }

  if (isBitcoinAddress(value)) {
    return success(rawInput, source, [{ type: 'bitcoin_onchain', value }]);
  }

  const recognizedScheme = source !== 'bare';
  return recognizedScheme
    ? { matched: true, ok: false, reason: 'Unrecognized payment format' }
    : { matched: false };
}
