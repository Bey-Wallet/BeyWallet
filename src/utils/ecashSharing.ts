import { sha256 } from '@noble/hashes/sha2';
import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
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
 * Encrypts a Cashu token symmetrically using NIP-44 v2
 */
export function encryptToken(token: string, encryptionKey: Uint8Array): string {
  return nip44.v2.encrypt(token, encryptionKey);
}

/**
 * Decrypts a Cashu token symmetrically using NIP-44 v2
 */
export function decryptToken(ciphertext: string, encryptionKey: Uint8Array): string {
  return nip44.v2.decrypt(ciphertext, encryptionKey);
}

/**
 * Creates and signs a kind 30078 Nostr event with the encrypted token
 * @param token Encoded Cashu token string
 * @param secretKeyHex 32-byte secret key in hex format
 */
export function buildEcashNostrEvent(token: string, secretKeyHex: string) {
  const keys = deriveSharingKeys(secretKeyHex);
  const encryptedContent = encryptToken(token, keys.encryptionKey);

  const eventTemplate = {
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', keys.dTag]],
    content: encryptedContent,
  };

  const signedEvent = finalizeEvent(eventTemplate, keys.ephemeralSkBytes);
  return {
    event: signedEvent,
    dTag: keys.dTag,
    ephemeralPk: keys.ephemeralPk,
  };
}
