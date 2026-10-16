import { nip19 } from 'nostr-tools';
import {
  buildPeopleListModel,
  peopleListEntries,
  peopleRowTime,
} from '~/features/people/peopleListModel';
import type { Person } from '~/state/peopleStore';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import type { NostrInboxItem } from '~/state/nostrInboxStore';

const alice = nip19.npubEncode('01'.repeat(32));
const bob = nip19.npubEncode('02'.repeat(32));
const eve = nip19.npubEncode('03'.repeat(32));
const time = new Date(2026, 8, 1, 12).getTime();
const person = (
  npub: string,
  displayName: string,
  contactStatus: Person['contactStatus'] = 'accepted',
): Person => ({ npub, displayName, contactStatus });
const message = (conversation: string, text: string, createdAt = time): ChatMessage => ({
  id: text,
  conversation,
  text,
  createdAt,
  receivedAt: createdAt,
  direction: 'incoming',
  publication: 'sent',
  read: false,
  transport: 'nip17',
});
const payment = (
  senderPubkey: string,
  status: NostrInboxItem['status'] = 'pending',
): NostrInboxItem => ({
  id: `${senderPubkey}-${status}`,
  senderPubkey,
  amount: 25,
  tokenString: 'cashuBsecret',
  mintUrl: 'https://mint.example',
  status,
  receivedAt: time + 1,
  seen: false,
});
const build = (overrides: Partial<Parameters<typeof buildPeopleListModel>[0]> = {}) =>
  buildPeopleListModel({
    people: {
      [alice]: person(alice, 'Alice'),
      [bob]: person(bob, 'Bob'),
      [eve]: person(eve, 'Eve', 'blocked'),
    },
    messages: [],
    inbox: [],
    history: [],
    unread: {},
    formatAmount: (amount) => `${amount} SATS`,
    ...overrides,
  });

it('uses the same latest activity for ordering and preview, including newer wallet history', () => {
  const model = build({
    messages: [message(alice, 'Old text')],
    inbox: [payment(bob, 'claimed')],
    history: [
      {
        id: 'latest',
        type: 'send',
        amount: 50,
        state: 'pending',
        createdAt: (time + 10000) / 1000,
        metadata: { nostrPubkey: alice },
      },
    ],
  });
  expect(model.conversations.map((row) => row.npub)).toEqual([alice, bob]);
  expect(model.conversations[0]).toMatchObject({
    updatedAt: time + 10000,
    preview: 'Awaiting claim · 50 SATS',
  });
});

it('sorts accepted contacts with no activity alphabetically after active conversations', () => {
  const model = build({
    people: {
      [bob]: person(bob, 'Zed'),
      [eve]: person(eve, 'Amy'),
      [alice]: person(alice, 'Middle'),
    },
    messages: [message(bob, 'Hello')],
  });
  expect(model.conversations.map((row) => row.name)).toEqual(['Zed', 'Amy', 'Middle']);
  expect(model.conversations[1]).toMatchObject({
    preview: 'Start a conversation',
    updatedAt: undefined,
  });
});

it('groups unknown invitations once per normalized identity and excludes blocked identities', () => {
  const model = build({
    people: { [alice]: person(alice, 'Alice', 'unaccepted'), [eve]: person(eve, 'Eve', 'blocked') },
    messages: [message(alice, 'Hello'), message(eve, 'Hidden')],
    inbox: [payment('01'.repeat(32)), { ...payment(alice), id: 'second' }, payment(eve)],
  });
  expect(model.invitations).toHaveLength(1);
  expect(model.requestCount).toBe(1);
  expect(model.invitations[0]).toMatchObject({
    npub: alice,
    preview: 'Pending contact acceptance · 25 SATS',
    unread: true,
  });
});

it('keeps actionable payment issues separate and never exposes failure payloads', () => {
  const pending = payment(alice, 'approval_required');
  const failed = {
    ...payment(alice, 'failed'),
    failure: { code: 'validation' as const, retryable: false, message: 'cashuBsecret' },
  };
  const model = build({
    inbox: [
      pending,
      failed,
      {
        ...payment(bob, 'failed'),
        failure: { code: 'network', retryable: true, message: 'Retry later' },
      },
    ],
  });
  expect(model.invitations).toHaveLength(0);
  expect(model.issues).toHaveLength(2);
  expect(model.requestCount).toBe(2);
  expect(model.issues.map((row) => row.preview)).toEqual(
    expect.arrayContaining(['Mint approval needed · 25 SATS', 'Payment needs review · 25 SATS']),
  );
  expect(JSON.stringify(model)).not.toContain('cashuBsecret');
});

it('retains legacy unaccepted profiles in search without creating an invitation', () => {
  const model = build({
    people: { [alice]: person(alice, 'Legacy', 'unaccepted') },
    query: 'Legacy',
  });
  expect(model.localSearch).toHaveLength(1);
  expect(model.invitations).toHaveLength(0);
  expect(model.conversations).toHaveLength(0);
});

it('deduplicates remote/local profiles and preserves blocked status and verified identity', () => {
  const profile = {
    pubkeyHex: '01'.repeat(32),
    npub: alice,
    displayName: 'Remote Alice',
    source: 'identifier' as const,
  };
  const model = build({
    query: 'example',
    people: {
      [alice]: { ...person(alice, 'Alice'), nip05: 'alice@example.com', nip05Verified: true },
      [eve]: { ...person(eve, 'Eve', 'blocked'), nip05: 'eve@example.com' },
    },
    remote: [
      profile,
      { ...profile, npub: bob, pubkeyHex: '02'.repeat(32) },
      { ...profile, npub: bob, pubkeyHex: '02'.repeat(32) },
    ],
  });
  expect(model.localSearch).toHaveLength(2);
  expect(model.localSearch[0].verified).toBe(true);
  expect(model.localSearch[1].preview).toContain('Blocked');
  expect(model.remoteSearch.map((row) => row.npub)).toEqual([bob]);
});

it.each([
  'cashuBsecret',
  'please receive cashuBsecret',
  'lnbc210n1ptestinvoice',
  'CREQbmalformed',
  'bitcoin:?req-cashuBsecret=1',
])('never displays payment payload %s as text', (text) => {
  const model = build({ messages: [message(alice, text)] });
  expect(model.conversations[0].preview).not.toContain(text);
  expect(model.conversations[0].preview).not.toContain('secret');
});

it('marks unread activity without leaking unread markers into previews and respects currency formatting', () => {
  const model = build({
    messages: [{ ...message(alice, 'Hi'), direction: 'outgoing', publication: 'failed' }],
    unread: { [alice]: 3 },
    inbox: [payment(bob)],
    formatAmount: () => '$2.00',
  });
  expect(model.conversations.find((row) => row.npub === alice)).toMatchObject({
    preview: 'Failed · You: Hi',
    unread: true,
  });
  expect(model.conversations.find((row) => row.npub === bob)?.preview).toContain('$2.00');
  expect(model.conversations.some((row) => row.preview.includes('Unread'))).toBe(false);
});

it('includes unknown incoming identities even before profile hydration', () => {
  const model = build({ people: {}, inbox: [payment('01'.repeat(32))] });
  expect(model.invitations[0].npub).toBe(alice);
});

it('keeps an existing identity discoverable when a remote lookup matches newer profile metadata', () => {
  const model = build({
    query: 'new-name',
    remote: [
      { npub: alice, pubkeyHex: '01'.repeat(32), displayName: 'new-name', source: 'identifier' },
    ],
  });
  expect(model.localSearch.map((row) => row.npub)).toEqual([alice]);
  expect(model.remoteSearch).toHaveLength(0);
});

it('paginates across groups without orphaned headings', () => {
  const items = build().conversations;
  const groups = [
    { title: 'First', items: [items[0]] },
    { title: 'Second', items: [items[1]] },
  ];
  expect(peopleListEntries(groups, 1).map((row) => row.id)).toEqual(['heading-First', items[0].id]);
  expect(peopleListEntries(groups, 2)).toHaveLength(4);
});

it('formats compact row dates without full timestamps', () => {
  const now = new Date(2026, 8, 10, 12);
  expect(peopleRowTime(undefined, now)).toBe('');
  expect(peopleRowTime(new Date(2026, 8, 9, 12).getTime(), now)).toBe('Yesterday');
  expect(peopleRowTime(new Date(2026, 8, 8).getTime(), now)).not.toContain('2026');
  expect(peopleRowTime(new Date(2025, 8, 8).getTime(), now)).toContain('2025');
});
