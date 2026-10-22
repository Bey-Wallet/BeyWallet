import { nip19 } from 'nostr-tools';
import { buildConversationActivity } from '~/features/people/conversationActivity';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import type { NostrInboxItem } from '~/state/nostrInboxStore';

const npub = nip19.npubEncode('02'.repeat(32));
const base: ChatMessage = {
  id: 'z-first',
  conversation: npub,
  text: 'First',
  direction: 'outgoing',
  createdAt: 1000,
  receivedAt: 1001,
  read: true,
  publication: 'sending',
  transport: 'nip17',
};

it('keeps payment notes on the payment card instead of creating a text message', () => {
  const [item] = buildConversationActivity(
    npub,
    [{ ...base, paymentId: 'payment', paymentAmount: 8, text: 'Lunch' }],
    [],
    [],
    true,
  );
  expect(item).toMatchObject({ kind: 'payment', text: '', note: 'Lunch', amount: 8 });
});

it('classifies persisted text independently from nullable or zero payment amounts', () => {
  const text = {
    ...base,
    paymentId: null,
    paymentAmount: null,
    paymentType: null,
  } as unknown as ChatMessage;
  expect(buildConversationActivity(npub, [text], [], [], true)[0]).toMatchObject({
    kind: 'text',
    text: 'First',
  });
  expect(
    buildConversationActivity(
      npub,
      [{ ...base, paymentId: 'payment', paymentAmount: 0 }],
      [],
      [],
      true,
    )[0],
  ).toMatchObject({ kind: 'payment', amount: 0, text: '' });
  expect(
    buildConversationActivity(npub, [{ ...base, paymentId: 'payment' }], [], [], true)[0].kind,
  ).toBe('payment');
});

it('keeps rapid messages in local send order even when rumor timestamps share a second', () => {
  const second = { ...base, id: 'a-second', text: 'Second', receivedAt: 1002 };
  expect(
    buildConversationActivity(npub, [second, base], [], [], true).map((item) => item.text),
  ).toEqual(['First', 'Second']);
});

it('shows one card for an inbox payment also present in wallet history', () => {
  const payment: NostrInboxItem = {
    id: 'payment',
    senderPubkey: '02'.repeat(32),
    tokenString: 'synthetic-secret',
    amount: 5,
    mintUrl: 'https://mint.example',
    receivedAt: 2000,
    status: 'claimed',
    seen: true,
  };
  const result = buildConversationActivity(
    npub,
    [],
    [payment],
    [
      {
        id: 'history',
        type: 'receive',
        amount: 5,
        createdAt: 2000,
        metadata: { nostrPubkey: npub, nostrEventId: 'payment' },
      },
    ],
    true,
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ type: 'Ecash', status: 'Claimed', requiresAction: false });
  expect(result[0].text).toBeUndefined();
});

it('keeps contact acceptance and mint approval separate when choosing warning cards', () => {
  const payment: NostrInboxItem = {
    id: 'payment',
    senderPubkey: '02'.repeat(32),
    tokenString: 'synthetic-secret',
    amount: 5,
    mintUrl: 'https://mint.example',
    receivedAt: 2000,
    status: 'approval_required',
    seen: true,
  };
  expect(buildConversationActivity(npub, [], [payment], [], false)[0]).toMatchObject({
    status: 'Pending contact acceptance',
    requiresAction: true,
  });
  expect(buildConversationActivity(npub, [], [payment], [], true)[0]).toMatchObject({
    status: 'Mint approval needed',
    requiresAction: true,
  });
});
