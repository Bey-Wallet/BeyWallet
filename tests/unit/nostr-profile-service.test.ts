import { nip19, type Event } from 'nostr-tools';
import { decodeNostrPublicKey, parseNostrProfileEvent } from '~/services/api/nostrProfileService';

const PUBKEY = '1'.repeat(64);

function profileEvent(content: string): Event {
  return {
    id: '2'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1,
    kind: 0,
    tags: [],
    content,
    sig: '3'.repeat(128),
  };
}

describe('nostrProfileService helpers', () => {
  it('normalizes supported public-key identifiers', () => {
    const npub = nip19.npubEncode(PUBKEY);
    const nprofile = nip19.nprofileEncode({ pubkey: PUBKEY, relays: [] });

    expect(decodeNostrPublicKey(PUBKEY.toUpperCase())).toBe(PUBKEY);
    expect(decodeNostrPublicKey(npub)).toBe(PUBKEY);
    expect(decodeNostrPublicKey(`nostr:${nprofile}`)).toBe(PUBKEY);
  });

  it('rejects unsupported or malformed identifiers', () => {
    expect(decodeNostrPublicKey('not-a-public-key')).toBeNull();
    expect(decodeNostrPublicKey('note1qqqqqq')).toBeNull();
  });

  it('parses bounded kind 0 profile metadata', () => {
    const profile = parseNostrProfileEvent(
      profileEvent(
        JSON.stringify({
          name: 'satoshi',
          display_name: 'Satoshi Nakamoto',
          nip05: 'satoshi@example.com',
          about: 'Bitcoin',
        }),
      ),
    );

    expect(profile).toMatchObject({
      pubkeyHex: PUBKEY,
      name: 'satoshi',
      displayName: 'Satoshi Nakamoto',
      nip05: 'satoshi@example.com',
      source: 'relay',
    });
  });

  it('ignores malformed metadata events', () => {
    expect(parseNostrProfileEvent(profileEvent('{not json'))).toBeNull();
    expect(parseNostrProfileEvent({ ...profileEvent('{}'), kind: 1 })).toBeNull();
  });
});
