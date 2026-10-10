import { PaymentRequest, type PaymentRequestTransport } from '@cashu/cashu-ts';
import { decode as decodeNostr } from 'nostr-tools/nip19';
import { decode as decodeCbor } from 'cbor-x';
import { Buffer } from 'buffer';

export interface ParsedPaymentRequest {
  raw: string;
  id?: string;
  amount: number;
  unit: 'sat';
  description?: string;
  singleUse: boolean;
  mints: string[];
  mintPolicy: 'strict' | 'preferred';
  transports: PaymentRequestTransport[];
  nostrTarget?: string;
  delivery: 'nip17' | 'nfc';
}

export function normalizePaymentMint(value: string): string {
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Invalid payment mint URL');
  }
  // URL normalizes the host, but paths remain case sensitive.
  return url.toString().replace(/\/$/, '');
}

export function parsePaymentRequest(
  raw: string,
  source: 'qr' | 'nfc' = 'qr',
): ParsedPaymentRequest {
  if (raw.length > 32_000) throw new Error('Payment request is too large');
  const cleaned = raw.trim();
  let request: PaymentRequest;
  let extensions: { mp?: unknown; sm?: unknown } = {};
  try {
    request = PaymentRequest.fromEncodedRequest(cleaned);
    // The installed SDK drops these newer NUT-18 fields. Inspect them before using its model.
    if (cleaned.startsWith('creqA')) {
      extensions = decodeCbor(Buffer.from(cleaned.slice(5), 'base64'));
    }
  } catch {
    throw new Error('Invalid Cashu payment request');
  }
  if (!Number.isSafeInteger(request.amount) || request.amount! <= 0) {
    throw new Error('Payment request must specify a positive whole amount');
  }
  if (request.unit !== 'sat') throw new Error('Only sat payment requests are supported');
  if (request.nut10) throw new Error('Payment request locking requirements are not supported');
  if (extensions.sm !== undefined) {
    throw new Error('Payment request method and fee requirements are not supported');
  }
  if (extensions.mp !== undefined && typeof extensions.mp !== 'boolean') {
    throw new Error('Invalid payment request mint policy');
  }
  const mints = [...new Set((request.mints ?? []).map(normalizePaymentMint))];
  const transports = (request.transport ?? []).map((transport) => ({
    ...transport,
    tags: transport.tags?.map((tag) => [...tag]),
  }));
  const nip17 = transports.find(
    (transport) =>
      transport.type === 'nostr' &&
      transport.tags?.some((tag) => tag[0] === 'n' && tag.slice(1).includes('17')),
  );
  if (nip17) {
    try {
      const target = nip17.target.trim();
      if (!/^[0-9a-f]{64}$/i.test(target)) {
        const decoded = decodeNostr(target);
        if (decoded.type !== 'npub' && decoded.type !== 'nprofile') throw new Error();
      }
    } catch {
      throw new Error('Invalid payment request recipient');
    }
  } else if (transports.length || source !== 'nfc') {
    throw new Error('No supported delivery method is available for this payment request');
  }
  return {
    raw: cleaned,
    id: request.id,
    amount: request.amount!,
    unit: 'sat',
    description: request.description,
    singleUse: request.singleUse,
    mints,
    mintPolicy: extensions.mp === true ? 'preferred' : 'strict',
    transports,
    nostrTarget: nip17?.target,
    delivery: nip17 ? 'nip17' : 'nfc',
  };
}

export function isPaymentMintAllowed(request: ParsedPaymentRequest, mintUrl: string): boolean {
  return (
    request.mintPolicy === 'preferred' ||
    request.mints.length === 0 ||
    request.mints.includes(normalizePaymentMint(mintUrl))
  );
}
