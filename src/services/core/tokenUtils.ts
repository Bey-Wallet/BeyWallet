/**
 * Token utilities — pure functions, no Manager dependency.
 * Handles token cleaning, encoding, decoding, and peanut format.
 */

import { getDecodedToken as getDecodedTokenCoco, getEncodedToken } from 'coco-cashu-core';
import { getEncodedTokenV4, getDecodedToken, PaymentRequest } from '@cashu/cashu-ts';
import type { DecodedTokenPreview } from './types';


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
function decodeV4TokenManually(cleaned: string): { mint: string; proofs: any[]; unit: string; amount: number } | null {
    try {
        if (!cleaned.startsWith('cashuB')) return null;

        const b64 = cleaned.substring(6);
        const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
        const pad = (4 - b64std.length % 4) % 4;
        const b64padded = b64std + '=='.substring(0, pad);

        let bytes: Uint8Array;
        if (typeof Buffer !== 'undefined') {
            bytes = new Uint8Array(Buffer.from(b64padded, 'base64'));
        } else {
            const bin = atob(b64padded);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        }

        // Minimal CBOR decoder — only handles map, array, text-string, byte-string, unsigned-int
        let pos = 0;
        function readCbor(): any {
            if (pos >= bytes.length) throw new Error('CBOR: unexpected end');
            const initial = bytes[pos++];
            const major = (initial >> 5) & 0x07;
            const info = initial & 0x1f;

            // Read length / value for additional info
            let len: number;
            if (info < 24) len = info;
            else if (info === 24) len = bytes[pos++];
            else if (info === 25) { len = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; }
            else if (info === 26) { len = ((bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3]) >>> 0; pos += 4; }
            else throw new Error('CBOR: unsupported length encoding: ' + info);

            if (major === 0) return len;   // unsigned int
            if (major === 2) {             // byte string
                const slice = bytes.slice(pos, pos + len); pos += len;
                return slice;
            }
            if (major === 3) {             // text string
                const slice = bytes.slice(pos, pos + len); pos += len;
                return new TextDecoder().decode(slice);
            }
            if (major === 4) {             // array
                const arr: any[] = [];
                for (let i = 0; i < len; i++) arr.push(readCbor());
                return arr;
            }
            if (major === 5) {             // map
                const obj: Record<string, any> = {};
                for (let i = 0; i < len; i++) {
                    const k = readCbor();
                    obj[String(k)] = readCbor();
                }
                return obj;
            }
            throw new Error('CBOR: unsupported major type: ' + major);
        }

        const cbor = readCbor();
        if (!cbor || typeof cbor !== 'object') return null;

        // V4 structure: { m: mintUrl, u: unit, t: [{ i: Uint8Array(8), p: [{ a, s, c }] }], d?: memo }
        const mint: string = typeof cbor.m === 'string' ? cbor.m : '';
        const unit: string = typeof cbor.u === 'string' ? cbor.u : 'sat';
        if (!mint) return null;

        const tokenGroups: any[] = Array.isArray(cbor.t) ? cbor.t : [];
        const proofs: any[] = [];

        for (const group of tokenGroups) {
            // 'i' is the raw 8-byte keyset ID (Uint8Array)
            const rawId: Uint8Array = group.i instanceof Uint8Array ? group.i : new Uint8Array(group.i || []);
            const keysetId = Array.from(rawId).map(b => b.toString(16).padStart(2, '0')).join('');
            const groupProofs: any[] = Array.isArray(group.p) ? group.p : [];

            for (const p of groupProofs) {
                // c (C) is a Uint8Array — hex encode it
                const C = p.c instanceof Uint8Array
                    ? Array.from(p.c).map(b => b.toString(16).padStart(2, '0')).join('')
                    : (typeof p.c === 'string' ? p.c : '');
                proofs.push({
                    id: keysetId,
                    amount: typeof p.a === 'number' ? p.a : 0,
                    secret: typeof p.s === 'string' ? p.s : '',
                    C,
                });
            }
        }

        const amount = proofs.reduce((acc, p) => acc + p.amount, 0);
        return { mint, proofs, unit, amount };
    } catch (e: any) {
        console.warn('[decodeToken] Manual V4 CBOR fallback error:', e?.message);
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
    console.log('[decodeToken] input prefix:', cleaned.substring(0, 40));

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
            memo = decoded.memo;
        } else if (decoded.mint && decoded.proofs) {
            // New flat shape: { mint, proofs, unit }
            mint = decoded.mint;
            proofs = decoded.proofs || [];
            unit = decoded.unit || 'sat';
            memo = decoded.memo;
        } else {
            throw new Error('Unrecognised token shape from getDecodedToken');
        }

        const totalAmount = proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
        console.log('[decodeToken] ✅ cashu-ts OK — mint:', mint, 'proofs:', proofs.length);
        return { mint, amount: totalAmount, unit, proofs, memo, raw: decoded };

    } catch (err1: any) {
        console.warn('[decodeToken] cashu-ts failed:', err1?.message);
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
            memo = decoded.memo;
        } else if (decoded.mint && decoded.proofs) {
            mint = decoded.mint;
            proofs = decoded.proofs || [];
            unit = decoded.unit || 'sat';
            memo = decoded.memo;
        } else {
            throw new Error('Unrecognised token shape from coco getDecodedToken');
        }

        const totalAmount = proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
        console.log('[decodeToken] ✅ coco-cashu-core OK — mint:', mint);
        return { mint, amount: totalAmount, unit, proofs, memo, raw: decoded };

    } catch (err2: any) {
        console.warn('[decodeToken] coco-cashu-core failed:', err2?.message);
    }

    // ── Manual fallback: cashuB (V4) CBOR — no keyset ID mapping needed ────
    // This is the key fix for V4 tokens from mints like testnut.cashu.space.
    // cashu-ts and coco both throw because they try to map the short 8-byte ID
    // to a full keyset ID before keysets are pre-synced. We bypass that entirely.
    if (cleaned.startsWith('cashuB')) {
        const v4Result = decodeV4TokenManually(cleaned);
        if (v4Result) {
            console.log('[decodeToken] ✅ Manual V4 CBOR fallback OK — mint:', v4Result.mint, 'proofs:', v4Result.proofs.length);
            return {
                mint: v4Result.mint,
                amount: v4Result.amount,
                unit: v4Result.unit,
                proofs: v4Result.proofs,
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
                    unit: first.unit || 'sat',
                    proofs,
                    raw: json,
                };
            }
        } catch (err3: any) {
            console.warn('[decodeToken] Manual V3 fallback failed:', err3?.message);
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
        throw new Error('This looks like a Lightning Invoice. Please use the "Send" tab to pay invoices.');
    }
    if (lower.startsWith('lnurl')) {
        throw new Error('This looks like an LNURL. LNURL deposits are not yet supported.');
    }

    console.error('[decodeToken] ❌ All decoders failed. Token prefix:', cleaned.substring(0, 50));
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

