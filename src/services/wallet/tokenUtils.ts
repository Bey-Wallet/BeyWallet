/**
 * Token utilities — pure functions, no Manager dependency.
 * Handles token cleaning, encoding, decoding, and peanut format.
 */

import { getDecodedToken as getDecodedTokenCoco, getEncodedToken } from 'coco-cashu-core';
import { getEncodedTokenV4, getDecodedToken, PaymentRequest } from '@cashu/cashu-ts';
import type { DecodedTokenPreview } from '~/services/wallet/types';
import { decode as decodeCbor, Encoder } from 'cbor-x';
import { Buffer } from 'buffer';

const tokenEncoder = new Encoder({ useRecords: false, tagUint8Array: false });

// ─── Token Cleaning ───────────────────────────────────────────

/**
 * Extract hidden Cashu tokens from "Peanut" format (Variation Selectors).
 */
export function extractPeanut(text: string): string | null {
  try {
    const decoded: string[] = [];
    const chars = Array.from(text);
    if (!chars.length) return null;

    for (const char of chars) {
      const codePoint = char.codePointAt(0);
      if (!codePoint) {
        if (decoded.length > 0) break;
        continue;
      }

      let byteValue: string | null = null;

      // Variation Selectors (VS1-VS16): U+FE00 to U+FE0F
      if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) {
        byteValue = String.fromCharCode(codePoint - 0xfe00);
      }
      // Variation Selectors Supplement (VS17-VS256): U+E0100 to U+E01EF
      else if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) {
        byteValue = String.fromCharCode(codePoint - 0xe0100 + 16);
      }

      if (byteValue === null && decoded.length > 0) {
        break;
      } else if (byteValue === null) {
        continue;
      }
      decoded.push(byteValue);
    }

    const result = decoded.join('');
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Clean a token string: remove prefixes, whitespace, extract peanut data,
 * and match standard cashu/creq patterns.
 */
export function cleanToken(tokenString: any): string {
  if (!tokenString) return '';

  let clean = '';

  // Handle potential array of numbers or Buffer
  if (Array.isArray(tokenString)) {
    // Only if it's an array of numbers (byte array)
    if (tokenString.length > 0 && typeof tokenString[0] === 'number') {
      clean = String.fromCharCode(...tokenString).trim();
    } else {
      // Probably a standard V3/V4 token object inside an array usually seen in legacy
      return '';
    }
  } else if (typeof tokenString === 'object' && tokenString !== null) {
    // If it's an object, we can't "clean" it as a string.
    // Caller should have encoded it first.
    return '';
  } else if (typeof tokenString !== 'string') {
    try {
      clean = tokenString.toString().trim();
      if (clean.startsWith('[object')) return '';
    } catch {
      return '';
    }
  } else {
    clean = tokenString.trim();
  }

  // 1. Try to extract Peanut data (variation selectors)
  const peanut = extractPeanut(clean);
  if (peanut) {
    clean = peanut;
  }

  // 2. Remove common prefixes
  const lowerClean = clean.toLowerCase();
  if (lowerClean.startsWith('cashu:')) {
    clean = clean.substring(6);
  } else if (lowerClean.startsWith('lightning:')) {
    clean = clean.substring(10);
  } else if (lowerClean.startsWith('creq:')) {
    clean = clean.substring(5);
  }

  // 3. Match standard cashu/creq token patterns
  const cashuMatch = clean.match(/(cashu|creq)[A-Za-z0-9+/=_-]+/);
  if (cashuMatch) {
    return cashuMatch[0];
  }

  return clean;
}

// ─── Token Encoding ───────────────────────────────────────────

/**
 * Encode a token object as V4 (CBOR), falling back to V3.
 */
export function encodeTokenV4(token: any): string {
  try {
    return getEncodedTokenV4(token);
  } catch {
    return getEncodedToken(token);
  }
}

/**
 * Encode a token object as V3 (JSON).
 */
export function encodeTokenV3(token: any): string {
  return getEncodedToken(token);
}

/**
 * Encode a token (defaults to V4).
 */
export function encodeToken(token: any): string {
  return encodeTokenV4(token);
}

/** Add public token metadata without changing any proofs or spending conditions. */
export function withTokenMemo(encoded: string, note: string): string {
  const memo = note.trim();
  if (!memo) return encoded;
  const cleaned = cleanToken(encoded);
  try {
    const bytes = Buffer.from(cleaned.slice(6).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    let payload: Uint8Array;
    if (cleaned.startsWith('cashuB')) {
      const token = decodeCbor(bytes);
      if (!token || typeof token.m !== 'string' || !Array.isArray(token.t)) throw new Error();
      payload = tokenEncoder.encode({ ...token, d: memo });
    } else if (cleaned.startsWith('cashuA')) {
      const token = JSON.parse(bytes.toString('utf8'));
      if (!token || !Array.isArray(token.token)) throw new Error();
      payload = Buffer.from(JSON.stringify({ ...token, memo }), 'utf8');
    } else throw new Error();
    const base64 = Buffer.from(payload)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return cleaned.slice(0, 6) + base64;
  } catch {
    throw new Error('Could not attach the note to this token.');
  }
}

/**
 * Encode a token string into "Peanut" format (Variation Selectors).
 */
export function encodePeanut(tokenStr: string): string {
  return (
    '🥜' +
    Array.from(tokenStr)
      .map((char) => {
        const byteValue = char.charCodeAt(0);
        if (byteValue >= 0 && byteValue <= 15) {
          return String.fromCodePoint(0xfe00 + byteValue);
        }
        if (byteValue >= 16 && byteValue <= 255) {
          return String.fromCodePoint(0xe0100 + (byteValue - 16));
        }
        return '';
      })
      .join('')
  );
}

// ─── Token Decoding ───────────────────────────────────────────

/**
 * Manually decode a V4 (cashuB) CBOR token without relying on cashu-ts key ID mapping.
 *
 * V4 tokens store proof key IDs as raw 8-byte Uint8Arrays (short IDs). The cashu-ts
 * `getDecodedToken` function tries to map these back to full keyset IDs, which fails
 * if the mint's keysets haven't been pre-synced. This function reads the CBOR directly
 * and hex-encodes the raw 8-byte ID (e.g. "01884a74bb2fc5ee") without mapping.
 *
 * Returns null if the token is not V4 or cannot be decoded.
 */
function decodeV4TokenManually(
  cleaned: string,
): { mint: string; proofs: any[]; unit: string; amount: number; memo?: string } | null {
  try {
    if (!cleaned.startsWith('cashuB')) return null;

    const b64 = cleaned.substring(6);
    const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64std.length % 4)) % 4;
    const b64padded = b64std + '=='.substring(0, pad);

    let bytes: Uint8Array;
    if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(b64padded, 'base64'));
    } else {
      const bin = atob(b64padded);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    }

    // Use the full CBOR decoder so valid indefinite maps and typed byte strings work too.
    const cbor = decodeCbor(bytes);
    if (!cbor || typeof cbor !== 'object') return null;

    // V4 structure: { m: mintUrl, u: unit, t: [{ i: Uint8Array(8), p: [{ a, s, c }] }], d?: memo }
    const mint: string = typeof cbor.m === 'string' ? cbor.m : '';
    const unit: string = typeof cbor.u === 'string' ? cbor.u : 'sat';
    if (!mint) return null;

    const tokenGroups: any[] = Array.isArray(cbor.t) ? cbor.t : [];
    const proofs: any[] = [];

    for (const group of tokenGroups) {
      // 'i' is the raw 8-byte keyset ID (Uint8Array)
      const rawId: Uint8Array =
        group.i instanceof Uint8Array ? group.i : new Uint8Array(group.i || []);
      const keysetId = Array.from(rawId)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (!keysetId) return null;
      const groupProofs: any[] = Array.isArray(group.p) ? group.p : [];

      for (const p of groupProofs) {
        // c (C) is a Uint8Array — hex encode it
        const commitment: Uint8Array | null =
          p.c instanceof Uint8Array ? (p.c as Uint8Array) : null;
        const C = commitment
          ? Array.from(commitment)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
          : typeof p.c === 'string'
            ? p.c
            : '';
        const proofAmount = typeof p.a === 'bigint' ? Number(p.a) : p.a;
        if (
          !Number.isSafeInteger(proofAmount) ||
          proofAmount <= 0 ||
          typeof p.s !== 'string' ||
          !p.s ||
          !C
        )
          return null;
        const hex = (value: unknown) => {
          if (!(value instanceof Uint8Array)) throw new Error('Invalid proof metadata');
          return Buffer.from(value).toString('hex');
        };
        proofs.push({
          id: keysetId,
          amount: proofAmount,
          secret: typeof p.s === 'string' ? p.s : '',
          C,
          ...(typeof p.w === 'string' ? { witness: p.w } : {}),
          ...(p.pe ? { p2pk_e: hex(p.pe) } : {}),
          ...(p.d ? { dleq: { e: hex(p.d.e), s: hex(p.d.s), r: hex(p.d.r) } } : {}),
        });
      }
    }

    const amount = proofs.reduce((acc, p) => acc + p.amount, 0);
    if (!proofs.length || !Number.isSafeInteger(amount)) return null;
    return { mint, proofs, unit, amount, memo: typeof cbor.d === 'string' ? cbor.d : undefined };
  } catch (e: any) {
    console.warn('[decodeToken] Manual V4 CBOR fallback failed');
    return null;
  }
}

/**
 * Decode a token string to preview its contents.
 * Handles V3 (cashuA, JSON) and V4 (cashuB, CBOR).
 *
 * Supports both token shapes returned by getDecodedToken:
 *   - New flat shape:   { mint, proofs, unit }
 *   - Old nested shape: { token: [{ mint, proofs }], unit }  (some V3 tokens)
 */
export function decodeToken(tokenString: string): DecodedTokenPreview {
  const cleaned = cleanToken(tokenString);

  // ── Primary: @cashu/cashu-ts — handles V3 (JSON) AND V4 (CBOR) ──────────
  try {
    const decoded = getDecodedToken(cleaned) as any;
    let mint = '';
    let proofs: any[] = [];
    let unit = 'sat';
    let memo: string | undefined;

    // Handle BOTH token shapes (walletService.ts pattern)
    if (decoded.token && Array.isArray(decoded.token) && decoded.token.length > 0) {
      // Old nested shape: { token: [{ mint, proofs }] }
      const first = decoded.token[0];
      mint = first.mint;
      proofs = first.proofs || [];
      unit = first.unit || decoded.unit || 'sat';
      memo = typeof decoded.memo === 'string' ? decoded.memo : undefined;
    } else if (decoded.mint && decoded.proofs) {
      // New flat shape: { mint, proofs, unit }
      mint = decoded.mint;
      proofs = decoded.proofs || [];
      unit = decoded.unit || 'sat';
      memo = typeof decoded.memo === 'string' ? decoded.memo : undefined;
    } else {
      throw new Error('Unrecognised token shape from getDecodedToken');
    }

    const totalAmount = proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
    console.log('[decodeToken] ✅ cashu-ts OK — mint:', mint, 'proofs:', proofs.length);
    return { mint, amount: totalAmount, unit, proofs, memo, raw: decoded };
  } catch (err1: any) {
    console.warn('[decodeToken] cashu-ts failed');
  }

  // ── Secondary: coco-cashu-core ───────────────────────────────────────────
  try {
    const decoded = getDecodedTokenCoco(cleaned) as any;
    let mint = '';
    let proofs: any[] = [];
    let unit = 'sat';
    let memo: string | undefined;

    if (decoded.token && Array.isArray(decoded.token) && decoded.token.length > 0) {
      const first = decoded.token[0];
      mint = first.mint;
      proofs = first.proofs || [];
      unit = first.unit || decoded.unit || 'sat';
      memo = typeof decoded.memo === 'string' ? decoded.memo : undefined;
    } else if (decoded.mint && decoded.proofs) {
      mint = decoded.mint;
      proofs = decoded.proofs || [];
      unit = decoded.unit || 'sat';
      memo = typeof decoded.memo === 'string' ? decoded.memo : undefined;
    } else {
      throw new Error('Unrecognised token shape from coco getDecodedToken');
    }

    const totalAmount = proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
    console.log('[decodeToken] ✅ coco-cashu-core OK — mint:', mint);
    return { mint, amount: totalAmount, unit, proofs, memo, raw: decoded };
  } catch (err2: any) {
    console.warn('[decodeToken] coco-cashu-core failed');
  }

  // ── Manual fallback: cashuB (V4) CBOR — no keyset ID mapping needed ────
  // This is the key fix for V4 tokens from mints like testnut.cashu.space.
  // cashu-ts and coco both throw because they try to map the short 8-byte ID
  // to a full keyset ID before keysets are pre-synced. We bypass that entirely.
  if (cleaned.startsWith('cashuB')) {
    const v4Result = decodeV4TokenManually(cleaned);
    if (v4Result) {
      console.log(
        '[decodeToken] ✅ Manual V4 CBOR fallback OK — mint:',
        v4Result.mint,
        'proofs:',
        v4Result.proofs.length,
      );
      return {
        mint: v4Result.mint,
        amount: v4Result.amount,
        unit: v4Result.unit,
        proofs: v4Result.proofs,
        memo: v4Result.memo,
      };
    }
  }

  // ── Manual fallback: cashuA (V3) only — base64 → JSON ───────────────────
  if (cleaned.startsWith('cashuA')) {
    try {
      const base64Part = cleaned.substring(6);
      const normalizedB64 = base64Part.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(Buffer.from(normalizedB64, 'base64').toString('utf8'));
      if (json.token && Array.isArray(json.token)) {
        const first = json.token[0];
        const proofs = first.proofs || [];
        console.log('[decodeToken] ✅ Manual V3 fallback OK');
        return {
          mint: first.mint,
          amount: proofs.reduce((acc: number, p: any) => acc + p.amount, 0),
          unit: first.unit || json.unit || 'sat',
          proofs,
          memo: typeof json.memo === 'string' ? json.memo : undefined,
          raw: json,
        };
      }
    } catch (err3: any) {
      console.warn('[decodeToken] Manual V3 fallback failed');
    }
  }

  // ── NUT-18 Payment Requests (creqA... / creqB...) ──────────────────────
  if (cleaned.startsWith('creq')) {
    const req = decodePaymentRequest(cleaned);
    return {
      mint: req.mints?.[0] || '',
      amount: req.amount || 0,
      unit: req.unit || 'sat',
      proofs: [],
      memo: req.description,
      isPaymentRequest: true,
      raw: req,
    };
  }
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('lnbc') || lower.startsWith('lightning:lnbc')) {
    throw new Error(
      'This looks like a Lightning Invoice. Please use the "Send" tab to pay invoices.',
    );
  }
  if (lower.startsWith('lnurl')) {
    throw new Error('This looks like an LNURL. LNURL deposits are not yet supported.');
  }

  console.error('[decodeToken] All token decoders failed');
  throw new Error('Invalid or unsupported cashu token format.');
}

/**
 * Decode a NUT-18 Payment Request (creqA... or creqB...) using standard @cashu/cashu-ts helpers.
 */
export function decodePaymentRequest(requestString: string) {
  const cleaned = cleanToken(requestString);
  try {
    const req = PaymentRequest.fromEncodedRequest(cleaned);
    return {
      raw: cleaned,
      id: req.id,
      amount: req.amount,
      unit: req.unit,
      description: req.description,
      mints: req.mints || [],
      transports: req.transport,
    };
  } catch (e: any) {
    console.warn('[tokenUtils] PaymentRequest.fromEncoded failed:', e?.message);
    throw new Error(`Invalid payment request format: ${e?.message || 'Failed to decode creq'}`);
  }
}
