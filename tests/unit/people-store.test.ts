import { nip19 } from 'nostr-tools';
import {
  migrateLegacyPeople,
  selectPendingActionCount,
  selectSortedPeople,
} from '~/state/contactsStore';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const first = nip19.npubEncode('01'.repeat(32));
const second = nip19.npubEncode('02'.repeat(32));

describe('unified People state', () => {
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
      isFavorite: true,
    });
  });

  it('sorts favorites first and then by derived interaction time', () => {
    const state = {
      people: {
        [first]: { npub: first, displayName: 'Alice', isFavorite: false },
        [second]: { npub: second, displayName: 'Bob', isFavorite: true },
      },
    } as any;

    expect(selectSortedPeople(state, { [first]: 200, [second]: 100 }).map((p) => p.npub)).toEqual([
      second,
      first,
    ]);
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
