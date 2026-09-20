import * as nip19 from 'nostr-tools/nip19';

/** Normalize an npub, nprofile, or 32-byte hex public key to npub form. */
export function normalizeNpub(pubkey: string): string {
  if (!pubkey) return '';

  const trimmed = pubkey.trim();
  if (trimmed.startsWith('npub1')) return trimmed;

  if (trimmed.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nprofile') {
        return nip19.npubEncode(decoded.data.pubkey);
      }
    } catch {}
    return trimmed;
  }

  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;

  try {
    return nip19.npubEncode(trimmed.toLowerCase());
  } catch {
    return trimmed;
  }
}
