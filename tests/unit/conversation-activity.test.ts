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

it('exposes available payload previews only for accepted contacts or outgoing messages', () => {
  const incoming: ChatMessage = {
    ...base,
    direction: 'incoming',
    text: 'lightning:lnbc210n1ptestinvoice',
  };
  expect(
    buildConversationActivity(npub, [incoming], [], [], false)[0].payloadPreview,
  ).toBeUndefined();
  expect(buildConversationActivity(npub, [incoming], [], [], true)[0].payloadPreview).toBe(
    'lnbc210n1ptestinvoice',
  );
  expect(
    buildConversationActivity(npub, [{ ...incoming, direction: 'outgoing' }], [], [], false)[0]
      .payloadPreview,
  ).toBe('lnbc210n1ptestinvoice');
});

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

it('distinguishes a received ecash token from an invoice/request without claiming it is paid', () => {
  const [token] = buildConversationActivity(
    npub,
    [{ ...base, direction: 'incoming', text: 'cashuBencoded' }],
    [],
    [],
    true,
  );
  expect(token).toMatchObject({
    kind: 'payment',
    type: 'Ecash',
    status: 'Review ecash token',
    text: '',
  });
  const [invoice] = buildConversationActivity(
    npub,
    [{ ...base, direction: 'incoming', text: 'lnbc210n1ptestinvoice' }],
    [],
    [],
    true,
  );
  expect(invoice).toMatchObject({
    kind: 'payment',
    type: 'Lightning · Invoice',
    status: 'Payment requested',
    text: '',
  });
});

it('renders independent embedded payment cards and keeps the context note without raw payloads', () => {
  const items = buildConversationActivity(
    npub,
    [
      {
        ...base,
        direction: 'incoming',
        text: 'Please use lnbc210n1ptestinvoice or alice@example.com thanks',
      },
    ],
    [],
    [],
    true,
  );
  expect(items).toHaveLength(2);
  expect(new Set(items.map((item) => item.id)).size).toBe(2);
  expect(items[0]).toMatchObject({
    kind: 'payment',
    note: 'Please use or thanks',
    text: '',
    type: 'Lightning · Invoice',
  });
  expect(items[1]).toMatchObject({ kind: 'payment', text: '', type: 'Lightning · Address' });
  expect(items[1].note).toBe('Please use or thanks');
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
