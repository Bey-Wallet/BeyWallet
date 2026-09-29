import { sha256 } from '@noble/hashes/sha2.js';

const ADJECTIVES = [
  'bold',
  'busy',
  'calm',
  'cute',
  'cool',
  'easy',
  'fast',
  'fine',
  'free',
  'glad',
  'good',
  'kind',
  'lazy',
  'nice',
  'neat',
  'soft',
  'spry',
  'tall',
  'warm',
  'wise',
  'wild',
  'cozy',
  'keen',
  'safe',
  'trim',
  'tiny',
  'zany',
  'snug',
  'jolly',
  'spicy',
];

const ANIMALS = [
  'ape',
  'bear',
  'bird',
  'bull',
  'cat',
  'deer',
  'dog',
  'duck',
  'elk',
  'frog',
  'goat',
  'hare',
  'hawk',
  'lion',
  'mole',
  'puma',
  'seal',
  'toad',
  'wolf',
  'fox',
  'owl',
  'crow',
  'swan',
  'dove',
  'crab',
  'fish',
  'clam',
  'ant',
  'bee',
  'wasp',
];

/**
 * Generates a human-friendly, unique, and deterministic username
 * based on the user's Nostr public key.
 *
 * @param pubkeyHex - The Nostr public key hex string
 * @returns Username string (e.g., "cozypandad202")
 */
export function generateDeterministicUsername(pubkeyHex: string): string {
  if (!pubkeyHex || pubkeyHex.length !== 64) {
    // Fallback for safety
    const rand = Math.floor(100 + Math.random() * 900);
    return `anon${rand}`;
  }

  try {
    // Convert hex pubkey to bytes
    const pubkeyBytes = new Uint8Array(
      pubkeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const hash = sha256(pubkeyBytes);

    // Modulo hashing to index lists deterministically
    const adjIndex = ((hash[0] << 8) | hash[1]) % ADJECTIVES.length;
    const animalIndex = ((hash[2] << 8) | hash[3]) % ANIMALS.length;

    const adjective = ADJECTIVES[adjIndex];
    const animal = ANIMALS[animalIndex];

    // Unique suffix using the last 4 characters of public key
    const suffix = pubkeyHex.slice(-4).toLowerCase();

    return `${adjective}${animal}${suffix}`;
  } catch (e) {
    return `user${pubkeyHex.slice(-4).toLowerCase()}`;
  }
}
