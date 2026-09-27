import { Buffer } from 'buffer';
import { nip19, SimplePool, type Event } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { nostrProfileService } from '~/services/api/nostrProfileService';
import { NIP17_INBOX_RELAYS, nostrService, RELAYS } from '~/services/wallet/nostrService';

export interface NostrRelayHealth {
  url: string;
  reachable: boolean;
  error?: string;
}

export interface NostrDiagnosticSnapshot {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checkedAt: number;
  nip05: {
    identifier: string | null;
    resolvedPubkey: string | null;
    matches: boolean;
  };
  profile: {
    present: boolean;
    nip05: string | null;
    nip05Matches: boolean;
  };
  inboxRelayList: {
    published: boolean;
    relays: string[];
    matches: boolean;
  };
  relays: NostrRelayHealth[];
}

function decodePrivateKey(nsec: string): string | null {
  if (/^[0-9a-f]{64}$/i.test(nsec)) return nsec.toLowerCase();
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') return null;
    return Buffer.from(decoded.data).toString('hex');
  } catch {
    return null;
  }
}

function getIdentity(): { npub: string | null; nsec: string | null; nip05: string | null } {
  const { useSettingsStore } = require('~/state/settingsStore');
  const { npub, nsec, nip05 } = useSettingsStore.getState();
  return { npub, nsec, nip05 };
}

function publicKeyHex(npub: string | null, nsec: string | null): string | null {
  if (npub) {
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'npub') {
        return typeof decoded.data === 'string'
          ? decoded.data.toLowerCase()
          : Buffer.from(decoded.data).toString('hex');
      }
    } catch {}
  }
  const privateKey = nsec ? decodePrivateKey(nsec) : null;
  return privateKey ? getPublicKey(Buffer.from(privateKey, 'hex')) : null;
}

async function queryRelay(
  relay: string,
  pubkey: string,
): Promise<{ health: NostrRelayHealth; events: Event[] }> {
  const pool = new SimplePool();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const events = await Promise.race([
      pool.querySync([relay], { authors: [pubkey], kinds: [0, 10050], limit: 10 }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Connection timed out')), 4_000);
      }),
    ]);
    return { health: { url: relay, reachable: true }, events };
  } catch (error) {
    return {
      health: {
        url: relay,
        reachable: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      events: [],
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    pool.close([relay]);
  }
}

async function resolveNip05Pubkey(identifier: string | null): Promise<string | null> {
  if (!identifier) return null;
  const result = await nostrProfileService.search(identifier).catch(() => []);
  return result.find((profile) => profile.nip05Verified)?.pubkeyHex || null;
}

export const nostrDiagnosticsService = {
  async getDiagnostics(): Promise<NostrDiagnosticSnapshot> {
    const identity = getIdentity();
    const pubkey = publicKeyHex(identity.npub, identity.nsec);
    if (!pubkey) {
      return {
        overall: 'unhealthy',
        checkedAt: Date.now(),
        nip05: { identifier: identity.nip05, resolvedPubkey: null, matches: false },
        profile: { present: false, nip05: null, nip05Matches: false },
        inboxRelayList: { published: false, relays: [], matches: false },
        relays: RELAYS.map((url) => ({ url, reachable: false, error: 'No public key' })),
      };
    }

    const [resolvedPubkey, relayResults] = await Promise.all([
      resolveNip05Pubkey(identity.nip05),
      Promise.all(RELAYS.map((relay) => queryRelay(relay, pubkey))),
    ]);
    const allEvents = relayResults.flatMap((result) => result.events);
    const newestProfile = allEvents
      .filter((event) => event.kind === 0)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const newestInbox = allEvents
      .filter((event) => event.kind === 10050)
      .sort((a, b) => b.created_at - a.created_at)[0];
    let profileNip05: string | null = null;
    try {
      profileNip05 = JSON.parse(newestProfile?.content || '{}').nip05 || null;
    } catch {}
    const inboxRelays =
      newestInbox?.tags.filter((tag) => tag[0] === 'relay' && tag[1]).map((tag) => tag[1]) || [];
    const relaySet = new Set(inboxRelays);
    const inboxMatches = NIP17_INBOX_RELAYS.every((relay) => relaySet.has(relay));
    const nip05Matches = !!identity.nip05 && resolvedPubkey === pubkey;
    const profileMatches =
      !!identity.nip05 && profileNip05?.toLowerCase() === identity.nip05.toLowerCase();
    const reachableCount = relayResults.filter((result) => result.health.reachable).length;
    const healthy =
      nip05Matches && !!newestProfile && profileMatches && !!newestInbox && inboxMatches;

    return {
      overall: healthy ? 'healthy' : reachableCount > 0 ? 'degraded' : 'unhealthy',
      checkedAt: Date.now(),
      nip05: { identifier: identity.nip05, resolvedPubkey, matches: nip05Matches },
      profile: { present: !!newestProfile, nip05: profileNip05, nip05Matches: profileMatches },
      inboxRelayList: { published: !!newestInbox, relays: inboxRelays, matches: inboxMatches },
      relays: relayResults.map((result) => result.health),
    };
  },

  async repairProfile(): Promise<boolean> {
    const identity = getIdentity();
    const privateKey = identity.nsec ? decodePrivateKey(identity.nsec) : null;
    const pubkey = publicKeyHex(identity.npub, identity.nsec);
    if (!privateKey || !pubkey || !identity.nip05) return false;
    return nostrService.publishProfile(identity.nip05, privateKey, pubkey);
  },

  republishInboxRelayList(): Promise<boolean> {
    return nostrService.republishInboxRelayList();
  },

  reconnectRelays(): void {
    nostrService.reconnectRelays();
  },
};
