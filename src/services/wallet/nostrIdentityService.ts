import { finalizeEvent } from 'nostr-tools/pure';
import { hexToBytes } from '@noble/hashes/utils.js';
import { nostrService } from '~/services/wallet/nostrService';

export const BEY_NIP05_DOMAIN = 'bey.cash';
export const BEY_NIP05_API = 'https://bey.cash/api';

export interface Nip05RegistrationResult {
  ok: boolean;
  nip05?: string;
  profilePublished?: boolean;
  error?: string;
}

const VERIFICATION_DELAYS_MS = [0, 400, 1_000, 2_000];

function normalizeUsername(username: string): string {
  return username
    .trim()
    .replace(/^@/, '')
    .replace(/@bey\.cash$/i, '')
    .toLowerCase();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveBeyNip05Pubkey(username: string): Promise<string | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  try {
    const response = await fetch(
      `https://${BEY_NIP05_DOMAIN}/.well-known/nostr.json?name=${encodeURIComponent(normalized)}&_t=${Date.now()}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const pubkey = data?.names?.[normalized];
    return typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)
      ? pubkey.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

async function verifyRegistration(username: string, pubkeyHex: string): Promise<boolean> {
  for (const delay of VERIFICATION_DELAYS_MS) {
    if (delay) await wait(delay);
    if ((await resolveBeyNip05Pubkey(username)) === pubkeyHex.toLowerCase()) return true;
  }
  return false;
}

export const nostrIdentityService = {
  registerUsername: async (
    username: string,
    pubkeyHex: string,
    privkeyHex: string,
  ): Promise<Nip05RegistrationResult> => {
    const normalized = normalizeUsername(username);
    if (!/^[a-z0-9_.-]{1,64}$/.test(normalized)) {
      return { ok: false, error: 'Username format is invalid.' };
    }
    if (!/^[0-9a-f]{64}$/i.test(pubkeyHex) || !/^[0-9a-f]{64}$/i.test(privkeyHex)) {
      return { ok: false, error: 'Nostr keys are invalid.' };
    }

    const normalizedPubkey = pubkeyHex.toLowerCase();
    const identifier = `${normalized}@${BEY_NIP05_DOMAIN}`;

    try {
      const profileEvent = await nostrService.createProfileEvent(
        identifier,
        privkeyHex,
        normalizedPubkey,
      );
      const proofEvent = finalizeEvent(
        {
          kind: 22242,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({
            username: normalized,
            domain: BEY_NIP05_DOMAIN,
            action: 'register',
          }),
        },
        hexToBytes(privkeyHex),
      );

      let verified = (await resolveBeyNip05Pubkey(normalized)) === normalizedPubkey;
      let serverProfilePublished = false;

      if (!verified) {
        const response = await fetch(`${BEY_NIP05_API}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: normalized,
            pubkey: normalizedPubkey,
            proofEvent,
            profileEvent,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          verified = (await resolveBeyNip05Pubkey(normalized)) === normalizedPubkey;
          if (!verified) {
            return { ok: false, error: data?.error || `Server error ${response.status}` };
          }
        } else if (!data?.success) {
          return { ok: false, error: 'Registration response was invalid.' };
        } else {
          serverProfilePublished = data.profilePublished === true;
          verified = await verifyRegistration(normalized, normalizedPubkey);
        }
      }

      if (!verified) {
        return {
          ok: false,
          error: 'The username was not visible in NIP-05. Please retry.',
        };
      }

      const profilePublished =
        serverProfilePublished || (await nostrService.publishProfileEvent(profileEvent));
      await nostrService.republishInboxRelayList();

      return { ok: true, nip05: identifier, profilePublished };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Network error' };
    }
  },
};
