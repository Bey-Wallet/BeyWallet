import { isLightningAddress } from '~/services/api/lnurlService';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';

export type UniversalInputType =
  | 'cashu_token'
  | 'cashu_request'
  | 'lightning_invoice'
  | 'lightning_address'
  | 'bitcoin_onchain'
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
  };
  error?: string;
}

/**
 * Robustly parse and categorize any input text or QR payload in Bey Wallet.
 */
export async function resolveUniversalInput(rawInput: string): Promise<UniversalInputResult> {
  const input = rawInput.trim();
  if (!input) {
    return { type: 'unknown', raw: rawInput, cleaned: '', error: 'Input is empty' };
  }

  // Domain usernames are Lightning addresses here, including the Lightning URI form.
  const lightningAddress = input.replace(/^lightning:/i, '').trim();
  if (isLightningAddress(lightningAddress)) {
    return {
      type: 'lightning_address',
      raw: rawInput,
      cleaned: lightningAddress,
      resolvedData: { address: lightningAddress },
    };
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

  const lower = input.toLowerCase();

  // LNURL (lnurl1...). Keep this ahead of bare username detection.
  if (lower.startsWith('lnurl1')) {
    return {
      type: 'lightning_address',
      raw: rawInput,
      cleaned: input,
      resolvedData: { address: input },
    };
  }

  // Person-to-person Nostr sends belong to People, never the universal payment input.
  if (
    /^(?:web\+nostr:|nostr:|npub1|nprofile1|nevent1|naddr1)/i.test(input) ||
    /^[0-9a-f]{64}$/i.test(input) ||
    /^(?:https?:\/\/)?bey\.cash\/(?:u|user)\//i.test(input) ||
    /^@?[a-z0-9._-]+$/i.test(input)
  ) {
    return {
      type: 'unknown',
      raw: rawInput,
      cleaned: input,
      error: 'To send to a person, use the People tab.',
    };
  }

  // Check for bey.cash share links (/c, /#c, /c#, /r, /#r, /r#).
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
  }

  return { type: 'unknown', raw: rawInput, cleaned: input, error: 'Unrecognized format' };
}
