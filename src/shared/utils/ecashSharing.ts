import { sha256 } from '@noble/hashes/sha2.js';
import { getPublicKey } from 'nostr-tools/pure';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';

export interface SharingKeys {
  ephemeralSkBytes: Uint8Array;
  ephemeralSkHex: string;
  ephemeralPk: string;
  encryptionKey: Uint8Array;
  dTag: string;
}

/**
 * Derives ephemeral Nostr signing keys, encryption keys, and lookup dTag from a secret key.
 * @param secretKeyHex 32-byte secret key in hex format (64 chars)
 */
export function deriveSharingKeys(secretKeyHex: string): SharingKeys {
  if (!secretKeyHex || secretKeyHex.length !== 64) {
    throw new Error('Invalid secret key hex format (must be 64 characters)');
  }

  const encoder = new TextEncoder();
  // Derive keys using sha256(secretKeyHex + label)
  const signingSeedBytes = sha256(encoder.encode(secretKeyHex + 'nostr:signing'));
  const encryptionKey = sha256(encoder.encode(secretKeyHex + 'aes:encryption'));
  const dTagBytes = sha256(encoder.encode(secretKeyHex + 'nostr:d_tag'));

  const ephemeralSkHex = Buffer.from(signingSeedBytes).toString('hex');
  const ephemeralPk = getPublicKey(signingSeedBytes);
  const dTag = Buffer.from(dTagBytes).toString('hex');

  return {
    ephemeralSkBytes: signingSeedBytes,
    ephemeralSkHex,
    ephemeralPk,
    encryptionKey,
    dTag,
  };
}

/**
 * Decrypts a Cashu token symmetrically using NIP-44 v2
 */
export function decryptToken(ciphertext: string, encryptionKey: Uint8Array): string {
  return nip44.v2.decrypt(ciphertext, encryptionKey);
}
