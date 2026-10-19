import { nip19 } from 'nostr-tools';
import { getPeopleUnreadCounts } from '~/features/people/peopleUnreadCounts';
import type { NostrInboxItem } from '~/state/nostrInboxStore';
import type { Person } from '~/state/peopleStore';

const alice = nip19.npubEncode('01'.repeat(32));
const bob = nip19.npubEncode('02'.repeat(32));
const eve = nip19.npubEncode('03'.repeat(32));
const people: Record<string, Person> = {
  [alice]: { npub: alice, contactStatus: 'accepted' },
  [bob]: { npub: bob, contactStatus: 'unaccepted' },
  [eve]: { npub: eve, contactStatus: 'blocked' },
};
const payment = (
  senderPubkey: string,
  overrides: Partial<NostrInboxItem> = {},
): NostrInboxItem => ({
  id: senderPubkey,
  senderPubkey,
  amount: 10,
  mintUrl: 'https://mint.example',
  tokenString: '',
  receivedAt: 1000,
  status: 'pending',
  seen: false,
  ...overrides,
});

it('counts each normalized conversation once across unread messages and payments, excluding blocks', () => {
  expect(
    getPeopleUnreadCounts(people, { [alice]: 4, [bob]: 2, [eve]: 9 }, [
      payment('01'.repeat(32)),
      payment(bob),
      payment(bob, { id: 'second' }),
      payment(eve),
    ]),
  ).toEqual({ recents: 1, requests: 1, total: 2 });
});

it('ignores seen and dismissed payments and completed invitations', () => {
  expect(
    getPeopleUnreadCounts(people, {}, [
      payment(alice, { seen: true }),
      payment(bob, { status: 'dismissed' }),
      payment(bob, { status: 'claimed' }),
    ]),
  ).toEqual({ recents: 0, requests: 0, total: 0 });
  expect(getPeopleUnreadCounts(people, {}, [payment(alice, { status: 'claimed' })]).total).toBe(1);
});

it('moves unread conversations to Recent when accepted and clears them after reading', () => {
  const unread = { [bob]: 3 };
  expect(getPeopleUnreadCounts(people, unread, []).requests).toBe(1);
  expect(
    getPeopleUnreadCounts(
      { ...people, [bob]: { ...people[bob], contactStatus: 'accepted' } },
      unread,
      [],
    ),
  ).toEqual({ recents: 1, requests: 0, total: 1 });
  expect(getPeopleUnreadCounts(people, {}, []).total).toBe(0);
});
