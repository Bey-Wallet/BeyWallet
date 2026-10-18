import { secp256k1 } from '@noble/curves/secp256k1.js';
import { decode } from 'nostr-tools/nip19';

/** Normalize public identifiers to the SEC1 key used in a Cashu P2PK condition. */
export function normalizeP2PKRecipient(input: string): string {
  try {
    let key = input.trim().replace(/^nostr:/i, '');
    if (/^(npub1|nprofile1)/i.test(key)) {
      const decoded = decode(key);
      if (decoded.type === 'npub') key = decoded.data;
      else if (decoded.type === 'nprofile') key = decoded.data.pubkey;
      else throw new Error();
    }
    key = key.replace(/^0x/i, '').toLowerCase();
    if (/^[a-f0-9]{64}$/.test(key)) key = `02${key}`;
    if (!/^(?:0[23][a-f0-9]{64}|04[a-f0-9]{128})$/.test(key)) throw new Error();
    return secp256k1.Point.fromHex(key).toHex(true);
  } catch {
    throw new Error('Enter a valid public key: hex, npub, or nprofile.');
  }
}
