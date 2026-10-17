import { cleanToken, decodeToken, encodeToken } from '~/services/wallet/tokenUtils';

/** Read persisted token formats without dropping proofs or exposing token data in logs. */
export function getHistoryToken(entry: {
  mintUrl: string;
  token?: unknown;
  metadata?: unknown;
}): string {
  let metadata = entry.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = undefined;
    }
  }
  const metadataToken =
    metadata && typeof metadata === 'object' && 'token' in metadata ? metadata.token : undefined;

  for (const candidate of [metadataToken, entry.token]) {
    if (candidate == null) continue;
    try {
      let value = candidate;
      if (typeof value === 'string' && /^[\[{]/.test(value.trim())) value = JSON.parse(value);
      if (Array.isArray(value)) {
        if (value.length !== 1) continue;
        value = value[0];
      }
      if (value && typeof value === 'object' && 'token' in value) {
        const legacy = value as {
          token?: { mint: string; proofs: unknown[] }[];
          unit?: string;
          memo?: string;
        };
        if (!Array.isArray(legacy.token) || legacy.token.length !== 1) continue;
        value = { ...legacy.token[0], unit: legacy.unit, memo: legacy.memo };
      }
      const encoded = typeof value === 'string' ? cleanToken(value) : encodeToken(value);
      const decoded = decodeToken(encoded);
      if (
        decoded.proofs.length === 0 ||
        decoded.mint.replace(/\/$/, '') !== entry.mintUrl.replace(/\/$/, '')
      )
        continue;
      return encoded;
    } catch {
      // Malformed metadata must not hide an otherwise valid history token.
    }
  }
  return '';
}

/** An empty or partial mint response is not evidence that funds are unclaimed. */
export function getVerifiedTokenState(states: { state: string }[], proofCount: number) {
  if (proofCount <= 0 || states.length !== proofCount) return undefined;
  if (states.every((state) => state.state === 'SPENT')) return 'claimed';
  if (states.some((state) => state.state === 'PENDING')) return 'pending';
  if (states.every((state) => state.state === 'UNSPENT')) return 'unclaimed';
  return undefined;
}
