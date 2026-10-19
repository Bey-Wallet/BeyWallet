import { nip19 } from 'nostr-tools';
import {
  migrateLegacyPeople,
  selectPeopleByRecency,
  selectPendingActionCount,
  usePeopleStore,
} from '~/state/peopleStore';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const first = nip19.npubEncode('01'.repeat(32));
const second = nip19.npubEncode('02'.repeat(32));

describe('unified People state', () => {
  it('unblocks selected blocked people in one persisted update and requires acceptance again', () => {
    usePeopleStore.setState({ people: {} });
    usePeopleStore
      .getState()
      .savePerson({ npub: first, displayName: 'Alice', contactStatus: 'blocked' });
    usePeopleStore
      .getState()
      .savePerson({ npub: second, displayName: 'Bob', contactStatus: 'blocked' });
    const accepted = nip19.npubEncode('03'.repeat(32));
    usePeopleStore.getState().savePerson({ npub: accepted, contactStatus: 'accepted' });
    jest.mocked(sqliteStorage.setItem).mockClear();
    usePeopleStore.getState().unblockPeople([first, first, '02'.repeat(32), accepted, 'invalid']);
    expect(sqliteStorage.setItem).toHaveBeenCalledTimes(1);
    expect(usePeopleStore.getState().people[first]).toMatchObject({
      contactStatus: 'unaccepted',
      requiresAcceptance: true,
      displayName: 'Alice',
    });
    expect(usePeopleStore.getState().people[second]).toMatchObject({
      contactStatus: 'unaccepted',
      requiresAcceptance: true,
    });
    expect(usePeopleStore.getState().people[accepted].contactStatus).toBe('accepted');
    expect(Object.keys(usePeopleStore.getState().people)).toHaveLength(3);
  });

  it('migrates contacts and favorites into one deduplicated map', () => {
    const people = migrateLegacyPeople({
      contacts: {
        [first]: { npub: first, displayName: 'Alice', isFavorite: false },
      },
      favorites: {
        [first]: { npub: first, nip05: 'alice@example.com', isFavorite: true },
      },
    });

    expect(Object.keys(people)).toEqual([first]);
    expect(people[first]).toMatchObject({
      displayName: 'Alice',
      nip05: 'alice@example.com',
      contactStatus: 'unaccepted',
    });
    expect(JSON.stringify(people)).not.toContain('isFavorite');
  });

  it('normalizes hex, npub and nprofile and preserves valid relay hints separately', () => {
    usePeopleStore.setState({ people: {} });
    usePeopleStore.getState().savePerson({ npub: '01'.repeat(32), displayName: 'Alice' });
    usePeopleStore.getState().savePerson({
      npub: nip19.nprofileEncode({
        pubkey: '01'.repeat(32),
        relays: ['wss://relay.example', 'https://invalid.example'],
      }),
    });
    usePeopleStore.getState().setContactStatus(first, 'accepted');
    expect(Object.keys(usePeopleStore.getState().people)).toEqual([first]);
    expect(usePeopleStore.getState().people[first]).toMatchObject({
      displayName: 'Alice',
      contactStatus: 'accepted',
      relayHints: ['wss://relay.example'],
    });
    const serialized = (sqliteStorage.setItem as jest.Mock).mock.calls.at(-1)[1];
    expect(serialized).not.toMatch(/isFavorite|favorites|contacts"/);
  });

  it('sorts strictly by derived interaction time regardless of favorite state', () => {
    const state = {
      people: {
        [first]: { npub: first, displayName: 'Alice', isFavorite: false },
        [second]: { npub: second, displayName: 'Bob', isFavorite: true },
      },
    } as any;

    expect(
      selectPeopleByRecency(state, { [first]: 200, [second]: 100 }).map((p) => p.npub),
    ).toEqual([first, second]);
    expect(selectPeopleByRecency(state).map((p) => p.npub)).toEqual([first, second]);
    expect(state.people[first]).toBeDefined();
  });

  it('counts only inbox items that require manual action', () => {
    expect(
      selectPendingActionCount([
        { status: 'approval_required' },
        { status: 'failed', failure: { retryable: false } },
        { status: 'failed', failure: { retryable: true } },
      ] as any),
    ).toBe(2);
  });
});
