import { MIGRATIONS } from '~/storage/sqlite/schema';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { useNostrInboxStore, type NostrInboxItem } from '~/state/nostrInboxStore';
import {
  matchReceiveRequest,
  recordRequestReceipt,
  requestLifecycleService,
  retryRequestPayment,
} from '~/services/wallet/requestLifecycleService';
import { usePeopleStore } from '~/state/peopleStore';
import { publishPaymentRequest } from '~/services/wallet/paymentRequestPublisher';
import { MessageRepository } from '~/storage/sqlite/repositories/MessageRepository';
import { buildConversationActivity } from '~/features/people/conversationActivity';
import { nip19 } from 'nostr-tools';

jest.mock('~/services/wallet/initService', () => ({
  getSharedDb: () => mockDb,
  initService: { getManager: () => mockManager, isInitialized: () => true },
}));
jest.mock('~/services/wallet/paymentRequestPublisher', () => ({
  publishPaymentRequest: jest.fn(async () => ({ eventId: 'wrap', acceptedRelays: [] })),
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: mockAuthenticated }) },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ biometricEnabled: true }) },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const { DatabaseSync } = require('node:sqlite');
let raw: any;
let mockDb: any;
let mockManager: any;
let mockAuthenticated = true;
const sender = '12'.repeat(32);
const npub = nip19.npubEncode(sender);
const request = {
  id: 'r1',
  mintUrl: 'https://mint.example',
  amount: 10,
  unit: 'sat',
  creqString: 'creqAfixture',
  nostrPubkey: 'our-key',
  recipient: npub,
};
const response = {
  id: 'response',
  type: 'token',
  requestId: 'r1',
  mintUrl: request.mintUrl,
  amount: 10,
  senderPubkey: sender,
  status: 'claimed',
  receiptVerified: true,
  receivedAt: 10,
  tokenString: 'never-render-this',
} as NostrInboxItem;

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  for (const id of ['015_nostr_receive_requests', '016_messages', '017_request_lifecycle'])
    raw.exec(MIGRATIONS.find((migration) => migration.id === id)!.sql);
  mockDb = {
    runAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).all(...params),
  };
  useNostrRequestStore.getState().clear();
  useNostrInboxStore.setState({ items: [] });
  usePeopleStore.setState({ people: {} });
  mockAuthenticated = true;
  jest.clearAllMocks();
});
afterEach(() => {
  requestLifecycleService.stop();
  raw.close();
});

it('preserves terminal requests through reload and duplicate creation; age is not expiry', async () => {
  const store = useNostrRequestStore.getState();
  await store.addRequest(request);
  await store.markReceived(request.id);
  await store.addRequest(request);
  store.clear();
  await store.loadPendingRequests();
  expect(useNostrRequestStore.getState().requests).toMatchObject([
    { id: 'r1', state: 'received', recipient: npub },
  ]);
  expect(useNostrRequestStore.getState().pendingRequests).toEqual([]);
  await store.addRequest({ ...request, id: 'old' });
  raw.exec("UPDATE coco_cashu_nostr_receive_requests SET createdAt = 1 WHERE id = 'old'");
  await store.clearExpiredRequests();
  expect(useNostrRequestStore.getState().pendingRequests).toMatchObject([{ id: 'old' }]);
});

it('requires a successful claim and never falls back when an explicit ID differs', async () => {
  const store = useNostrRequestStore.getState();
  await store.addRequest(request);
  const pending = useNostrRequestStore.getState().pendingRequests;
  expect(
    matchReceiveRequest([{ ...pending[0], createdAt: 1 }], {
      ...response,
      receiptCreatedAt: 5,
      receivedAt: 10,
    }),
  ).toBeUndefined();
  await recordRequestReceipt({ ...response, receiptVerified: undefined });
  await recordRequestReceipt({ ...response, receiptCreatedAt: 1 });
  expect(useNostrRequestStore.getState().requests[0].state).toBe('pending');
  expect(matchReceiveRequest(pending, { ...response, requestId: 'different' })).toBeUndefined();
  expect(
    matchReceiveRequest(pending, { ...response, senderPubkey: '34'.repeat(32) }),
  ).toBeUndefined();
  expect(matchReceiveRequest(pending, { ...response, amount: 12 })?.id).toBe('r1');
  expect(matchReceiveRequest(pending, { ...response, unit: 'usd' })).toBeUndefined();
  for (const status of ['pending', 'contact_required', 'approval_required', 'failed'] as const)
    await recordRequestReceipt({ ...response, status });
  expect(useNostrRequestStore.getState().requests[0].state).toBe('pending');
  await store.addRequest({ ...request, id: 'r2' });
  expect(
    matchReceiveRequest(useNostrRequestStore.getState().pendingRequests, {
      ...response,
      requestId: undefined,
    }),
  ).toBeUndefined();
  await recordRequestReceipt(response);
  expect(useNostrRequestStore.getState().requests.find((r) => r.id === 'r1')?.state).toBe(
    'received',
  );
  expect(useNostrRequestStore.getState().requests.find((r) => r.id === 'r2')?.state).toBe(
    'pending',
  );
});

it('retains pending status offline and distinguishes rollback from payment', async () => {
  const store = useNostrRequestStore.getState();
  await store.savePayment({
    id: 'offline',
    requestId: 'r1',
    operationId: 'op',
    state: 'pending',
    published: true,
  });
  const listeners = new Map<string, () => void>();
  let state = 'pending';
  const manager = {
    on: (event: string, handler: () => void) => {
      listeners.set(event, handler);
      return () => {};
    },
    send: {
      getOperation: async () => ({ state }),
      checkPendingOperation: async () => {
        throw new Error('offline');
      },
    },
  };
  requestLifecycleService.start(manager as any);
  await requestLifecycleService.reconcile();
  expect(useNostrRequestStore.getState().payments[0].state).toBe('pending');
  state = 'rolled_back';
  listeners.get('send:rolled-back')!();
  await requestLifecycleService.reconcile();
  await store.loadPendingRequests();
  expect(useNostrRequestStore.getState().payments[0].state).toBe('rolled_back');
});

it('blocks encrypted delivery retries while locked or blocked and reuses the saved operation after unlock', async () => {
  mockManager = { send: { getOperation: async () => ({ state: 'pending' }) } };
  const publication = {
    event: { kind: 1059, id: 'wrap', content: 'ciphertext' },
    relays: ['wss://relay.example'],
    recipientRelays: [],
  } as any;
  await useNostrRequestStore.getState().savePayment({
    id: 'retry',
    requestId: 'r1',
    conversation: npub,
    operationId: 'op',
    state: 'pending',
    published: false,
    publication,
  });
  mockAuthenticated = false;
  await expect(retryRequestPayment('retry')).rejects.toThrow('Unlock');
  mockAuthenticated = true;
  usePeopleStore.getState().setContactStatus(npub, 'blocked');
  await expect(retryRequestPayment('retry')).rejects.toThrow('Unblock');
  expect(publishPaymentRequest).not.toHaveBeenCalled();
  usePeopleStore.getState().setContactStatus(npub, 'unaccepted');
  await retryRequestPayment('retry');
  expect(publishPaymentRequest).toHaveBeenCalledTimes(1);
  expect(publishPaymentRequest).toHaveBeenCalledWith(publication);
  expect(useNostrRequestStore.getState().payments[0]).toMatchObject({
    operationId: 'op',
    published: true,
  });
});

it('adds lifecycle columns without changing legacy request states or inventing recipients', () => {
  const legacy = new DatabaseSync(':memory:');
  try {
    for (const id of ['015_nostr_receive_requests', '016_messages'])
      legacy.exec(MIGRATIONS.find((m) => m.id === id)!.sql);
    legacy.exec(
      "INSERT INTO coco_cashu_nostr_receive_requests (id, mintUrl, amount, creqString, nostrPubkey, state, createdAt, updatedAt) VALUES ('old', 'https://mint.example', 10, 'creqAold', 'our-key', 'received', 1, 1)",
    );
    legacy.exec(MIGRATIONS.find((m) => m.id === '017_request_lifecycle')!.sql);
    expect(
      legacy.prepare('SELECT id, state, recipient FROM coco_cashu_nostr_receive_requests').all(),
    ).toEqual([{ id: 'old', state: 'received', recipient: null }]);
  } finally {
    legacy.close();
  }
});

it('recovers linked operation completion without the payment screen and updates the request card', async () => {
  const store = useNostrRequestStore.getState();
  await store.savePayment({
    id: 'payment',
    requestId: 'r1',
    conversation: npub,
    inboxId: 'invitation',
    operationId: 'op',
    state: 'pending',
    published: true,
  });
  store.clear();
  const listeners = new Map<string, () => void>();
  const removed = jest.fn();
  let state = 'pending';
  const manager = {
    on: (event: string, handler: () => void) => {
      listeners.set(event, handler);
      return removed;
    },
    send: { getOperation: async () => ({ state }), checkPendingOperation: async () => {} },
  };
  requestLifecycleService.start(manager as any);
  await requestLifecycleService.reconcile();
  const invitation = {
    ...response,
    id: 'invitation',
    type: 'request',
    status: 'pending',
  } as NostrInboxItem;
  let activity = buildConversationActivity(
    npub,
    [],
    [invitation],
    [],
    true,
    useNostrRequestStore.getState(),
  );
  expect(activity[0]).toMatchObject({ status: 'Awaiting claim', requiresAction: false });
  state = 'finalized';
  listeners.get('send:finalized')!();
  await requestLifecycleService.reconcile();
  await store.loadPendingRequests();
  activity = buildConversationActivity(
    npub,
    [],
    [invitation],
    [],
    true,
    useNostrRequestStore.getState(),
  );
  expect(activity[0]).toMatchObject({ status: 'Paid', requiresAction: false });
  // A late publisher update cannot regress a confirmed payment.
  await store.savePayment({ ...useNostrRequestStore.getState().payments[0], state: 'pending' });
  expect(useNostrRequestStore.getState().payments[0].state).toBe('paid');
  requestLifecycleService.stop();
  expect(removed).toHaveBeenCalledTimes(3);
});

it('persists request chat linkage and keeps request payloads out of text', async () => {
  await useNostrRequestStore.getState().addRequest(request);
  const repository = new MessageRepository({
    run: (sql: string, params: unknown[]) => mockDb.runAsync(sql, ...params),
    all: (sql: string, params: unknown[]) => mockDb.getAllAsync(sql, ...params),
  } as any);
  await repository.insert({
    id: 'card',
    conversation: npub,
    direction: 'outgoing',
    createdAt: 1,
    receivedAt: 1,
    text: '',
    read: true,
    publication: 'sending',
    transport: 'nip17',
    requestId: 'r1',
    paymentId: 'card',
    paymentType: 'request',
    paymentAmount: 10,
  });
  let messages = await repository.page(npub);
  expect(
    buildConversationActivity(npub, messages, [], [], true, useNostrRequestStore.getState())[0],
  ).toMatchObject({ kind: 'payment', status: 'Sending', text: '' });
  await repository.setPublication('card', 'sent');
  messages = await repository.page(npub);
  expect(
    buildConversationActivity(npub, messages, [], [], true, useNostrRequestStore.getState())[0]
      .status,
  ).toBe('Awaiting payment');
  await recordRequestReceipt(response);
  expect(
    buildConversationActivity(npub, messages, [], [], true, useNostrRequestStore.getState())[0]
      .status,
  ).toBe('Received');
});
