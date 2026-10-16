import { nip19 } from 'nostr-tools';
import { nostrProfileService } from '~/services/api/nostrProfileService';
import { syncConversationContact } from '~/features/people/syncConversationContact';
import { usePeopleStore } from '~/state/peopleStore';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/services/api/nostrProfileService', () => ({
  ...jest.requireActual('~/services/api/nostrProfileService'),
  nostrProfileService: { getProfile: jest.fn(), search: jest.fn() },
}));

const pubkey = '02'.repeat(32);
const npub = nip19.npubEncode(pubkey);
const profile = {
  pubkeyHex: pubkey,
  npub,
  name: 'Bob',
  picture: 'https://example.com/new.png',
  nip05: 'bob@example.com',
  source: 'relay' as const,
};

describe('conversation contact sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePeopleStore.setState({ people: {} });
    usePeopleStore.getState().savePerson({
      npub,
      username: 'Bob',
      nip05: 'bob@example.com',
      nip05Verified: true,
      picture: 'https://example.com/old.png',
      contactStatus: 'accepted',
    });
    jest.mocked(nostrProfileService.getProfile).mockResolvedValue(profile);
  });

  it('verifies the full address and updates the avatar without changing acceptance or identity', async () => {
    jest
      .mocked(nostrProfileService.search)
      .mockResolvedValue([{ ...profile, nip05Verified: true }]);
    expect(await syncConversationContact(npub)).toContain('Address verified');
    expect(nostrProfileService.getProfile).toHaveBeenCalledWith(npub, { forceRefresh: true });
    expect(nostrProfileService.search).toHaveBeenCalledWith('bob@example.com');
    expect(usePeopleStore.getState().people[npub]).toMatchObject({
      npub,
      contactStatus: 'accepted',
      picture: profile.picture,
      nip05Verified: true,
    });
  });

  it('does not retarget a contact when their address resolves to another key', async () => {
    jest.mocked(nostrProfileService.search).mockResolvedValue([
      {
        ...profile,
        pubkeyHex: '03'.repeat(32),
        npub: nip19.npubEncode('03'.repeat(32)),
        nip05Verified: true,
      },
    ]);
    expect(await syncConversationContact(npub)).toContain('public key was kept');
    expect(Object.keys(usePeopleStore.getState().people)).toEqual([npub]);
    expect(usePeopleStore.getState().people[npub]).toMatchObject({
      npub,
      nip05Verified: false,
      picture: profile.picture,
    });
  });

  it('rejects mismatched profile identities and never reaccepts blocked people', async () => {
    jest
      .mocked(nostrProfileService.getProfile)
      .mockResolvedValue({ ...profile, pubkeyHex: '04'.repeat(32) });
    await expect(syncConversationContact(npub)).rejects.toThrow('Profile unavailable');
    expect(usePeopleStore.getState().people[npub].picture).toBe('https://example.com/old.png');
    usePeopleStore.getState().setContactStatus(npub, 'blocked');
    jest.mocked(nostrProfileService.getProfile).mockResolvedValue(profile);
    jest
      .mocked(nostrProfileService.search)
      .mockResolvedValue([{ ...profile, nip05Verified: true }]);
    await syncConversationContact(npub);
    expect(usePeopleStore.getState().people[npub].contactStatus).toBe('blocked');
  });
});
