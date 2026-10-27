import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import { nostrService } from '~/services/wallet/nostrService';
import { createChatCopies, decryptAuthenticated } from '~/services/wallet/nostrChatTransport';
import { usePeopleStore } from '~/state/peopleStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { getEncodedTokenV3, PaymentRequest } from '@cashu/cashu-ts';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { nostrClaimService } from '~/services/wallet/nostrClaimService';

const mockMessages = new Map<string, ChatMessage>();
jest.mock('~/services/wallet/nostrClaimService', () => ({
  nostrClaimService: { enqueue: jest.fn() },
}));
const mockRepository = {
  recover: jest.fn(async () => undefined),
  insert: jest.fn(async (message: ChatMessage) => {
    if (mockMessages.has(message.id)) return false;
    mockMessages.set(message.id, { ...message });
    return true;
  }),
  findRequest: jest.fn(async () => undefined),
  setPublication: jest.fn(async (id: string, publication: ChatMessage['publication']) => {
    mockMessages.set(id, { ...mockMessages.get(id)!, publication });
  }),
  setEnvelopes: jest.fn(async (id: string, envelopes: ChatMessage['envelopes']) => {
    mockMessages.set(id, { ...mockMessages.get(id)!, envelopes });
  }),
};
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    isInitialized: () => true,
    getRepo: () => ({ messageRepository: mockRepository }),
  },
}));
jest.mock('~/state/messageStore', () => ({
  useMessageStore: {
    getState: () => ({ refresh: jest.fn(async () => undefined), clear: jest.fn() }),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ biometricEnabled: false }) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: true }) },
}));

describe('persistent chat publication and sender copies', () => {
  const sender = generateSecretKey();
  const receiver = generateSecretKey();
  const recipient = getPublicKey(receiver);
  const service = nostrService as any;
  let publish: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessages.clear();
    usePeopleStore.setState({ people: {} });
    service.privkeyHex = bytesToHex(sender);
    service.privkeyBytes = sender;
    service.pubkeyHex = getPublicKey(sender);
    service.isRunning = true;
    service.processedEvents.clear();
    publish = jest.fn(() => [Promise.resolve('accepted')]);
    service.pool = {
      publish,
      querySync: jest.fn(async () => [
        finalizeEvent(
          {
            kind: 10050,
            created_at: 100,
            tags: [['relay', 'wss://inbox.example']],
            content: '',
          },
          receiver,
        ),
      ]),
    };
  });

  afterEach(() => {
    service.pool = null;
    service.isRunning = false;
    service.privkeyHex = null;
  });

  it('publishes only to advertised recipient inboxes, then accepts the recipient', async () => {
    await nostrService.sendChat(recipient, 'Hello');
    expect(publish.mock.calls[0][0]).toEqual(['wss://inbox.example']);
    expect(publish.mock.calls[0][1].kind).toBe(1059);
    expect([...mockMessages.values()][0].publication).toBe('sent');
    expect(usePeopleStore.getState().people[normalizeNpub(recipient)].contactStatus).toBe(
      'accepted',
    );
  });

  it('shares an existing token as a payment card, retaining its memo and sender copy', async () => {
    const encoded = getEncodedTokenV3({
      mint: 'https://mint.example',
      unit: 'sat',
      memo: 'Lunch',
      proofs: [
        {
          id: '00' + 'ab'.repeat(7),
          amount: 5,
          secret: 'synthetic-only',
          C: '02' + '11'.repeat(32),
        },
      ],
    });
    await nostrService.sendChat(recipient, encoded);
    const message = [...mockMessages.values()][0];
    expect(message).toMatchObject({
      paymentType: 'token',
      paymentAmount: 5,
      text: 'Lunch',
      publication: 'sent',
    });
    expect((await decryptAuthenticated(publish.mock.calls[0][1], bytesToHex(receiver)))?.text).toBe(
      encoded,
    );
    expect(message.text).not.toContain('cashu');
    await service._processEvent(message.envelopes![1].event);
    expect(mockMessages.size).toBe(1);
    expect(nostrClaimService.enqueue).not.toHaveBeenCalled();
  });

  it('shares requests created outside People and requires recipient acknowledgement', async () => {
    const encoded = new PaymentRequest(
      [],
      'outside-people',
      5,
      'sat',
      ['https://mint.example'],
      'Lunch',
    ).toEncodedRequest();
    publish.mockImplementation(() => [Promise.reject(new Error('recipient unavailable'))]);
    await expect(nostrService.sendChat(recipient, encoded)).rejects.toThrow('publication failed');
    const message = [...mockMessages.values()][0];
    expect(message).toMatchObject({
      paymentType: 'request',
      requestId: 'outside-people',
      paymentAmount: 5,
      text: 'Lunch',
      publication: 'failed',
    });
    expect(publish).toHaveBeenCalledTimes(1);
    publish.mockImplementation(() => [Promise.resolve('accepted')]);
    await nostrService.retryChat(message);
    expect(mockMessages.get(message.id)?.publication).toBe('sent');
  });

  it('rejects malformed pasted payments before persisting or publishing', async () => {
    await expect(nostrService.sendChat(recipient, 'cashuAbroken')).rejects.toThrow();
    expect(mockMessages.size).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('saves outgoing requests before acknowledgement and retries the same encrypted events', async () => {
    const encoded = new PaymentRequest([], 'request-id', 10, 'sat', [
      'https://mint.example',
    ]).toEncodedRequest();
    publish.mockImplementation(() => [Promise.reject(new Error('offline'))]);
    await expect(
      nostrService.sendRequest(recipient, encoded, 'request-id', 10, bytesToHex(sender)),
    ).rejects.toThrow('publication failed');
    const message = [...mockMessages.values()][0];
    expect(message).toMatchObject({
      paymentType: 'request',
      requestId: 'request-id',
      publication: 'failed',
      text: '',
      paymentAmount: 10,
    });
    const ids = message.envelopes!.map((envelope) => envelope.event.id);
    expect(message.envelopes!.map((envelope) => envelope.event.kind)).toEqual([4, 1059]);
    publish.mockImplementation(() => [Promise.resolve('accepted')]);
    await nostrService.retryChat(message);
    expect([...mockMessages.values()]).toHaveLength(1);
    expect(mockMessages.get(message.id)?.publication).toBe('sent');
    expect(publish.mock.calls.slice(-2).map((call) => call[1].id)).toEqual(ids);
  });

  it('deduplicates a request received concurrently through the legacy and gift-wrap transports', async () => {
    const encoded = new PaymentRequest([], 'duplicate-request', 10, 'sat', [
      'https://mint.example',
    ]).toEncodedRequest();
    useNostrInboxStore.setState({ items: [] });
    const lookup = jest.spyOn(service, 'getSenderUsername').mockResolvedValue('alice');
    try {
      await Promise.all([
        service._handleDecrypted(encoded, { id: 'legacy' }, recipient),
        service._handleDecrypted(encoded, { id: 'wrap' }, recipient),
      ]);
      expect(useNostrInboxStore.getState().items).toHaveLength(1);
      expect(useNostrInboxStore.getState().items[0]).toMatchObject({
        requestId: 'duplicate-request',
        type: 'request',
      });
    } finally {
      lookup.mockRestore();
      useNostrInboxStore.setState({ items: [] });
    }
  });

  it('preserves failed encrypted envelopes and retries the same logical message', async () => {
    publish.mockImplementation(() => [Promise.reject(new Error('offline'))]);
    await expect(nostrService.sendChat(recipient, 'Saved for retry')).rejects.toThrow(
      'publication failed',
    );
    const message = [...mockMessages.values()][0];
    expect(message.publication).toBe('failed');
    expect(usePeopleStore.getState().people[normalizeNpub(recipient)]).toBeUndefined();
    const originalEnvelope = publish.mock.calls[0][1];
    publish.mockImplementation(() => [Promise.resolve('accepted')]);
    await nostrService.retryChat(message);
    expect(publish.mock.calls[1][1]).toEqual(originalEnvelope);
    expect(mockMessages.size).toBe(1);
    expect(mockMessages.get(message.id)?.publication).toBe('sent');
  });

  it('reports missing inbox relays without downgrading or accepting', async () => {
    service.pool.querySync.mockResolvedValue([]);
    await expect(nostrService.sendChat(recipient, 'No downgrade')).rejects.toThrow(
      'no NIP-17 inbox relays',
    );
    expect(publish).not.toHaveBeenCalled();
    expect(mockMessages.size).toBe(1);
    expect([...mockMessages.values()][0].publication).toBe('failed');
    expect(Object.keys(usePeopleStore.getState().people)).toHaveLength(0);
  });

  it('does not accept resolved connection-failure strings as relay acknowledgements', async () => {
    publish.mockImplementation(() => [Promise.resolve('connection failure: timed out')]);
    await expect(nostrService.sendChat(recipient, 'Not acknowledged')).rejects.toThrow(
      'publication failed',
    );
    expect([...mockMessages.values()][0].publication).toBe('failed');
    expect(usePeopleStore.getState().people[normalizeNpub(recipient)]).toBeUndefined();
  });

  it('queues a persistent bubble before relay discovery finishes', async () => {
    let discover!: (events: unknown[]) => void;
    service.pool.querySync.mockImplementation(
      () =>
        new Promise((resolve) => {
          discover = resolve;
        }),
    );
    let queued!: () => void;
    const appeared = new Promise<void>((resolve) => {
      queued = resolve;
    });
    const onQueued = jest.fn(() => queued());
    const sending = nostrService.sendChat(recipient, 'Appears immediately', onQueued);
    // Attach failure handling before completing the deliberately unavailable lookup.
    const failed = expect(sending).rejects.toThrow('no NIP-17 inbox relays');
    await appeared;
    expect([...mockMessages.values()][0]).toMatchObject({
      text: 'Appears immediately',
      publication: 'sending',
    });
    expect(publish).not.toHaveBeenCalled();
    // Let persistence/summary refresh settle into the pending relay query.
    for (let step = 0; step < 8 && !discover; step++) await Promise.resolve();
    discover([]);
    await failed;
    expect(onQueued).toHaveBeenCalledTimes(1);
  });

  it('records sender copies as outgoing and never routes payment copies into claims', async () => {
    const text = createChatCopies('Sent elsewhere', recipient, sender);
    const token = getEncodedTokenV3({
      mint: 'https://mint.example',
      unit: 'sat',
      proofs: [
        {
          id: '00' + 'ab'.repeat(7),
          amount: 5,
          secret: 'synthetic-only',
          C: '02' + '11'.repeat(32),
        },
      ],
    });
    const payment = createChatCopies(token, recipient, sender);
    await service._processEvent(text.sender);
    await service._processEvent(text.sender);
    await service._processEvent(payment.sender);
    expect([...mockMessages.values()]).toMatchObject([
      { id: text.rumor.id, direction: 'outgoing', conversation: normalizeNpub(recipient) },
      {
        id: payment.rumor.id,
        direction: 'outgoing',
        text: '',
        paymentAmount: 5,
        paymentId: payment.rumor.id,
      },
    ]);
    expect(nostrClaimService.enqueue).not.toHaveBeenCalled();
    expect(JSON.stringify([...mockMessages.values()])).not.toContain('synthetic-only');
  });

  it('blocks outbound publication to blocked people', async () => {
    usePeopleStore.getState().setContactStatus(recipient, 'blocked');
    await expect(nostrService.sendChat(recipient, 'Blocked')).rejects.toThrow('Unblock');
    expect(publish).not.toHaveBeenCalled();
  });

  it('recovers interrupted publications on wallet startup and closes subscriptions on stop', async () => {
    const { AppState } = require('react-native');
    const previousAppState = AppState.currentState;
    AppState.currentState = 'active';
    const close = jest.fn();
    const subscribe = jest.spyOn(service, '_subscribe').mockImplementation(() => {
      service.subscription = { close };
    });
    const advertise = jest.spyOn(service, '_publishInboxRelayList').mockResolvedValue(true);
    const reconnect = jest
      .spyOn(service, '_startReconnectLoop')
      .mockImplementation(() => undefined);
    const appState = jest.spyOn(service, '_listenAppState').mockImplementation(() => undefined);
    service.isRunning = false;
    nostrService.start(bytesToHex(sender), getPublicKey(sender));
    await Promise.resolve();
    expect(mockRepository.recover).toHaveBeenCalledTimes(1);
    nostrService.stop();
    expect(close).toHaveBeenCalledTimes(1);
    subscribe.mockRestore();
    advertise.mockRestore();
    reconnect.mockRestore();
    appState.mockRestore();
    AppState.currentState = previousAppState;
  });
});
