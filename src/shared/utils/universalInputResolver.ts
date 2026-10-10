import { nip19 } from 'nostr-tools';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';

export type UniversalInputType =
  | 'cashu_token'
  | 'cashu_request'
  | 'lightning_invoice'
  | 'lightning_address'
  | 'bitcoin_onchain'
  | 'nostr_contact'
  | 'bey_username'
  | 'bey_share_token'
  | 'bey_share_request'
  | 'unknown';

export interface UniversalInputResult {
  type: UniversalInputType;
  raw: string;
  cleaned: string;
  resolvedData?: {
    token?: string;
    paymentRequest?: string;
    invoice?: string;
    address?: string;
    npub?: string;
    username?: string;
    isBeyDomain?: boolean;
  };
  error?: string;
}

/**
 * Resolve NIP-05 identifier to hex pubkey and npub
 */
export async function resolveNip05(
  address: string,
): Promise<{ npub: string; username: string } | null> {
  try {
    let name = address.trim();
    let domain = 'bey.cash';

    if (name.includes('@')) {
      const parts = name.split('@');
      if (parts.length === 2 && parts[0] && parts[1]) {
        name = parts[0];
        domain = parts[1];
      }
    }

    // Clean leading @ if present
    if (name.startsWith('@')) name = name.substring(1);

    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name.toLowerCase())}&_t=${Date.now()}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const pubkey = data?.names?.[name.toLowerCase()];
      if (pubkey) {
        const npub = nip19.npubEncode(pubkey);
        return { npub, username: domain === 'bey.cash' ? name : `${name}@${domain}` };
      }
    }
  } catch (e) {
    console.warn('[UniversalResolver] NIP-05 resolution failed:', e);
  }
  return null;
}

/**
 * Robustly parse and categorize any input text or QR payload in Bey Wallet.
 */
export async function resolveUniversalInput(rawInput: string): Promise<UniversalInputResult> {
  let input = rawInput.trim();
  if (!input) {
    return { type: 'unknown', raw: rawInput, cleaned: '', error: 'Input is empty' };
  }

  // 1. Parse payment inputs, including Numo-style BIP-321 unified URIs.
  const paymentInput = parsePaymentInput(rawInput);
  if (paymentInput.matched) {
    if (!paymentInput.ok) {
      return {
        type: 'unknown',
        raw: rawInput,
        cleaned: input,
        error: paymentInput.reason,
      };
    }

    const { primary } = paymentInput.value;
    switch (primary.type) {
      case 'cashu_token':
        return {
          type: 'cashu_token',
          raw: rawInput,
          cleaned: primary.value,
          resolvedData: { token: primary.value },
        };
      case 'cashu_request':
        return {
          type: 'cashu_request',
          raw: rawInput,
          cleaned: primary.value,
          resolvedData: { paymentRequest: primary.value },
        };
      case 'lightning_invoice':
        return {
          type: 'lightning_invoice',
          raw: rawInput,
          cleaned: primary.value,
          resolvedData: { invoice: primary.value },
        };
      case 'bitcoin_onchain':
        return {
          type: 'bitcoin_onchain',
          raw: rawInput,
          cleaned: primary.value,
          resolvedData: { address: primary.value },
        };
      case 'bolt12_offer':
        return {
          type: 'unknown',
          raw: rawInput,
          cleaned: primary.value,
          error: 'BOLT12 offers are not supported yet',
        };
    }
  }

  // 2. Strip non-payment web/app URI prefixes
  let lower = input.toLowerCase();
  if (lower.startsWith('web+nostr:')) input = input.slice(10);
  else if (lower.startsWith('nostr://')) input = input.slice(8);
  else if (lower.startsWith('nostr:')) input = input.slice(6);

  lower = input.toLowerCase();

  // 3. Check for exclusive bey.cash share links (/c, /#c, /c#, /r, /#r, /r#)
  if (
    lower.includes('bey.cash/') ||
    lower.includes('/c#') ||
    lower.includes('/c/#') ||
    lower.includes('/c/') ||
    lower.includes('/r#') ||
    lower.includes('/r/#') ||
    lower.includes('/r/')
  ) {
    // eCash Share Links (/c)
    const eCashMarkers = ['/c/#', '/c#', '/#c/', '/c/'];
    for (const marker of eCashMarkers) {
      const idx = lower.indexOf(marker);
      if (idx !== -1) {
        const extractedToken = input.slice(idx + marker.length).trim();
        if (extractedToken) {
          return {
            type: 'bey_share_token',
            raw: rawInput,
            cleaned: extractedToken,
            resolvedData: { token: extractedToken },
          };
        }
      }
    }

    // Request Share Links (/r)
    const requestMarkers = ['/r/#', '/r#', '/#r/', '/r/'];
    for (const marker of requestMarkers) {
      const idx = lower.indexOf(marker);
      if (idx !== -1) {
        const extractedRequest = input.slice(idx + marker.length).trim();
        if (extractedRequest) {
          return {
            type: 'bey_share_request',
            raw: rawInput,
            cleaned: extractedRequest,
            resolvedData: { paymentRequest: extractedRequest },
          };
        }
      }
    }

    // User Profile Links (bey.cash/u/username or bey.cash/user/username)
    if (lower.includes('bey.cash/u/') || lower.includes('bey.cash/user/')) {
      try {
        const urlObj = new URL(input.startsWith('http') ? input : `https://${input}`);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        if (last) {
          const resolved = await resolveNip05(`${last}@bey.cash`);
          if (resolved) {
            return {
              type: 'bey_username',
              raw: rawInput,
              cleaned: resolved.username,
              resolvedData: { npub: resolved.npub, username: resolved.username, isBeyDomain: true },
            };
          }
        }
      } catch (e) {}
    }
  }

  // 4. LNURL (lnurl1...)
  if (lower.startsWith('lnurl1')) {
    return {
      type: 'lightning_address',
      raw: rawInput,
      cleaned: input,
      resolvedData: { address: input },
    };
  }

  // 5. Nostr NPUB / Nprofile / Nevent / Naddr / 64-char Hex Pubkey
  if (
    lower.startsWith('npub1') ||
    lower.startsWith('nprofile1') ||
    lower.startsWith('nevent1') ||
    lower.startsWith('naddr1') ||
    /^[0-9a-fA-F]{64}$/.test(input)
  ) {
    try {
      let npub = input;
      if (/^[0-9a-fA-F]{64}$/.test(input)) {
        npub = nip19.npubEncode(input.toLowerCase());
      } else if (!lower.startsWith('npub1')) {
        const decoded = nip19.decode(input);
        if (decoded.type === 'nprofile') {
          const data = decoded.data as any;
          npub = nip19.npubEncode(data.pubkey);
        } else if (decoded.type === 'npub') {
          npub = input;
        } else {
          throw new Error('Unsupported Nostr structure');
        }
      }
      return {
        type: 'nostr_contact',
        raw: rawInput,
        cleaned: npub,
        resolvedData: { npub },
      };
    } catch (e) {
      return { type: 'unknown', raw: rawInput, cleaned: input, error: 'Invalid Nostr identifier' };
    }
  }

  // 6. NIP-05 Username (e.g. satoshi@bey.cash, alice@domain.com, @satoshi, or plain username satoshi)
  if (
    input.includes('@') ||
    /^[a-zA-Z0-9._-]+$/.test(input.startsWith('@') ? input.slice(1) : input)
  ) {
    let lookupAddress = input;
    if (lookupAddress.startsWith('@')) lookupAddress = lookupAddress.slice(1);
    if (!lookupAddress.includes('@')) {
      lookupAddress = `${lookupAddress}@bey.cash`;
    }

    const isBeyDomain = lookupAddress.toLowerCase().endsWith('@bey.cash');
    const resolved = await resolveNip05(lookupAddress);

    if (resolved) {
      return {
        type: 'bey_username',
        raw: rawInput,
        cleaned: resolved.username,
        resolvedData: {
          npub: resolved.npub,
          username: resolved.username,
          isBeyDomain,
        },
      };
    }

    // If NIP-05 fails for a external email-like string (e.g. user@getalby.com), treat as Lightning Address!
    if (input.includes('@') && !isBeyDomain) {
      return {
        type: 'lightning_address',
        raw: rawInput,
        cleaned: input,
        resolvedData: { address: input },
      };
    }

    if (isBeyDomain) {
      return {
        type: 'unknown',
        raw: rawInput,
        cleaned: input,
        error: `Username '${input}' not found on bey.cash`,
      };
    }
  }

  return { type: 'unknown', raw: rawInput, cleaned: input, error: 'Unrecognized format' };
}
