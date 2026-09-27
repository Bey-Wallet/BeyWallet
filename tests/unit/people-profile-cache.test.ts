import { nip19 } from 'nostr-tools';
import {
  needsNostrProfileRefresh,
  personUpdateFromProfile,
} from '~/features/contacts/profileCache';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const PUBKEY = '4'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);

describe('People profile cache', () => {
  it('refreshes npub-only and placeholder identities', () => {
    expect(needsNostrProfileRefresh({ npub: NPUB, isFavorite: false })).toBe(true);
    expect(
      needsNostrProfileRefresh({ npub: NPUB, username: 'Nostr user', isFavorite: false }),
    ).toBe(true);
  });

  it('keeps recently cached identities without another relay lookup', () => {
    expect(
      needsNostrProfileRefresh(
        {
          npub: NPUB,
          displayName: 'Gloomy Widow',
          nip05: 'gloomywidow@minibits.cash',
          nip05Verified: true,
          profileUpdatedAt: 1_000,
          isFavorite: false,
        },
        2_000,
      ),
    ).toBe(false);
  });

  it('maps relay metadata into persistable People fields', () => {
    expect(
      personUpdateFromProfile(
        {
          pubkeyHex: PUBKEY,
          npub: NPUB,
          name: 'gloomywidow',
          displayName: 'Gloomy Widow',
          nip05: 'gloomywidow@minibits.cash',
          nip05Verified: true,
          picture: 'https://minibits.cash/avatar.png',
          source: 'relay',
        },
        123,
      ),
    ).toMatchObject({
      npub: NPUB,
      username: 'gloomywidow',
      displayName: 'Gloomy Widow',
      nip05: 'gloomywidow@minibits.cash',
      nip05Verified: true,
      profileUpdatedAt: 123,
    });
  });
});
