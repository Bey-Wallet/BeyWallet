import { sha256 } from '@noble/hashes/sha2';
import { finalizeEvent } from 'nostr-tools/pure';
import { Buffer } from 'buffer';

const ADJECTIVES = [
    'bold', 'busy', 'calm', 'cute', 'cool', 'easy', 'fast', 'fine', 'free', 'glad',
    'good', 'kind', 'lazy', 'nice', 'neat', 'soft', 'spry', 'tall', 'warm', 'wise',
    'wild', 'cozy', 'keen', 'safe', 'trim', 'tiny', 'zany', 'snug', 'jolly', 'spicy'
];

const ANIMALS = [
    'ape', 'bear', 'bird', 'bull', 'cat', 'deer', 'dog', 'duck', 'elk', 'frog',
    'goat', 'hare', 'hawk', 'lion', 'mole', 'puma', 'seal', 'toad', 'wolf', 'fox',
    'owl', 'crow', 'swan', 'dove', 'crab', 'fish', 'clam', 'ant', 'bee', 'wasp'
];

const DOMAIN = 'bey.cash';
const API_BASE = 'https://bey.cash/api';

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

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
            pubkeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
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

/**
 * Registers a NIP-05 username on the bey.cash API registry.
 */
export async function registerNip05Username(
    username: string,
    hexPubkey: string,
    hexPrivkey: string
): Promise<{ ok: boolean; error?: string; nip05?: string }> {
    try {
        const privkeyBytes = hexToBytes(hexPrivkey);
        const proofEvent = finalizeEvent({
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify({
                username: username.toLowerCase(),
                domain: DOMAIN,
                action: 'register',
            }),
        }, privkeyBytes);

        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username.toLowerCase(),
                pubkey: hexPubkey,
                proofEvent,
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            const errMsg = data?.error || `Server error ${res.status}`;
            return { ok: false, error: errMsg };
        }

        const data = await res.json().catch(() => null);
        if (!data?.success) return { ok: false, error: 'Registration response invalid' };
        
        return { ok: true, nip05: data.nip05 };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

