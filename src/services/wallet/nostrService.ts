import {
  decryptAuthenticated,
  createChatCopies,
  isPaymentShaped,
  validRelay,
} from './nostrChatTransport';
import { applyIncomingContactPolicy, contactPolicyReady } from './contactPolicy';
import { normalizeNpub } from '~/shared/utils/nostr';
import { useMessageStore } from '~/state/messageStore';
import type { ChatEnvelope, ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { SimplePool, type Filter, type Event, nip04, nip44, finalizeEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip59';
import { hexToBytes } from '@noble/hashes/utils.js';
import { decode as nip19Decode } from 'nostr-tools/nip19';
import { Buffer } from 'buffer';
import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
// Removed top level walletService import to break require cycle.
import { decodeToken } from '~/services/wallet/tokenUtils';
import { inspectChatPayment } from './chatPayment';
import { nostrRequestStore } from '~/state/nostrRequestStore';

import { normalizeRelayUrl } from '~/shared/utils/nostrRelays';
import { getNostrRelays, getNostrInboxRelays, useNostrRelayStore } from '~/state/nostrRelayStore';

// ─── Event Kinds ──────────────────────────────────────────────────────────────
//
// Kind 4    — NIP-04 Legacy encrypted DM  (cashu.me legacy, some wallets)
// Kind 13   — NIP-17 "Sealed DM" (inner event, encrypted with NIP-44)
// Kind 14   — NIP-17 Private DM  (inner event, encrypted with NIP-44)
// Kind 1059 — NIP-59 Gift-Wrap outer event (wraps Kind 13/14)
//
const LISTENED_KINDS = [4, 1059];

// How many seconds back to fetch on first connection
const SINCE_SECONDS = 7 * 24 * 60 * 60; // Recover messages after several days offline
const MAX_NOSTR_PAYMENT_MESSAGE_LENGTH = 64 * 1024;

export async function hasSuccessfulRelayPublish(
  publishAttempts: Promise<unknown>[],
): Promise<boolean> {
  const results = await Promise.allSettled(publishAttempts.map(requireRelayAcknowledgement));
  return results.some((result) => result.status === 'fulfilled');
}

function requireRelayAcknowledgement(attempt: Promise<unknown>): Promise<unknown> {
  return attempt.then((result) => {
    if (typeof result === 'string' && result.startsWith('connection failure: ')) {
      throw new Error('Relay connection failed');
    }
    return result;
  });
}

async function publishChatEnvelope(pool: SimplePool, envelope: ChatEnvelope): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.any(pool.publish(envelope.relays, envelope.event).map(requireRelayAcknowledgement)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Relay acknowledgement timed out')), 10_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function resolveNostrRecipient(identifier: string): {
  pubkey: string;
  relayHints: string[];
} {
  const normalized = identifier.trim();
  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    return { pubkey: normalized.toLowerCase(), relayHints: [] };
  }

  const decoded = nip19Decode(normalized);
  if (decoded.type === 'npub') {
    return { pubkey: decoded.data as string, relayHints: [] };
  }
  if (decoded.type === 'nprofile') {
    const data = decoded.data as { pubkey: string; relays?: string[] };
    const relayHints = (data.relays || []).filter((relay) => {
      try {
        const url = new URL(relay);
        return (
          url.protocol === 'wss:' && !!url.hostname && !url.username && !url.password && !url.hash
        );
      } catch {
        return false;
      }
    });
    return { pubkey: data.pubkey, relayHints };
  }

  throw new Error('Unsupported Nostr identifier');
}

/**
 * Build a standards-compliant NIP-59 gift wrap containing a NIP-17 kind-14 message.
 * Delegating this to nostr-tools ensures the unsigned rumor includes its required event id.
 */
export function createNip17GiftWrap(
  message: string,
  recipientPubkeyHex: string,
  senderPrivkeyHex: string,
): Event {
  return wrapEvent(
    {
      kind: 14,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkeyHex]],
      content: message,
    },
    hexToBytes(senderPrivkeyHex),
    recipientPubkeyHex,
  );
}

// Reconnect interval when the pool drops
const RECONNECT_INTERVAL_MS = 30_000;

/**
 * Background Nostr listener for incoming Cashu ecash payments.
 *
 * Supports:
 * - NIP-04 Kind 4  (legacy, used by older wallets)
 * - NIP-17 Kind 14 in Kind 1059 gift-wrap (used by minibits ≥ v0.1.5)
 *
 * Both V3 (cashuA) and V4 (cashuB) token patterns are recognized.
 */
class NostrService {
  private subscription: { close: () => void } | null = null;
  private generation = 0;
  private connectedRelays: string[] = [];

  constructor() {
    useNostrRelayStore.subscribe((state, previous) => {
      if (state.relays === previous.relays || !this.isRunning) return;
      this.refresh();
      void this._publishInboxRelayList();
    });
  }

  private chatPublishing = new Set<string>();

  private async initializeChat(): Promise<void> {
    try {
      const { initService } =
        require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
      await initService.getRepo().messageRepository.recover();
      if (this.isRunning) await useMessageStore.getState().refresh();
    } catch {
      console.warn('[NostrService] Chat storage is not ready.');
    }
  }

  private async inboxRelays(pubkey: string, relayHints: string[] = []): Promise<string[]> {
    if (!this.pool) throw new Error('Open and unlock your wallet to send a message.');
    const { usePeopleStore } =
      require('~/state/peopleStore') as typeof import('~/state/peopleStore');
    const hints = [
      ...(usePeopleStore.getState().people[normalizeNpub(pubkey)]?.relayHints || []),
      ...relayHints,
    ].filter(validRelay);
    const events = await this.pool.querySync([...new Set([...getNostrRelays(), ...hints])], {
      kinds: [10050],
      authors: [pubkey],
      limit: 5,
    });
    const { verifyEvent } = require('nostr-tools') as typeof import('nostr-tools');
    const newest = events
      .filter((event) => event.pubkey === pubkey && event.kind === 10050 && verifyEvent(event))
      .sort((a, b) => b.created_at - a.created_at)[0];
    const relays = [
      ...new Set(
        (newest?.tags || [])
          .filter((tag) => tag[0] === 'relay' && validRelay(tag[1]))
          .map((tag) => tag[1]),
      ),
    ];
    if (!relays.length)
      throw new Error(
        'This person has no NIP-17 inbox relays. Ask them to open a compatible chat client and publish their inbox relay list.',
      );
    return relays;
  }

  public async sendChat(
    identifier: string,
    text: string,
    onQueued?: (message: ChatMessage) => void,
  ): Promise<void> {
    if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
    const generation = this.generation;
    text = text.trim();
    if (!text || text.length > 16000)
      throw new Error('Enter a message of up to 16,000 characters.');
    const payment = isPaymentShaped(text) ? inspectChatPayment(text) : undefined;
    if (!this.privkeyBytes || !this.pubkeyHex)
      throw new Error('Open and unlock your wallet first.');
    const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
    const { useSettingsStore } =
      require('~/state/settingsStore') as typeof import('~/state/settingsStore');
    if (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated) {
      throw new Error('Unlock your wallet first.');
    }
    const recipient = resolveNostrRecipient(identifier);
    const { usePeopleStore } =
      require('~/state/peopleStore') as typeof import('~/state/peopleStore');
    if (usePeopleStore.getState().people[normalizeNpub(identifier)]?.contactStatus === 'blocked') {
      throw new Error('Unblock this person in Nostr Settings first.');
    }
    if (recipient.relayHints.length) usePeopleStore.getState().savePerson({ npub: identifier });
    if (!this.privkeyBytes || !this.isRunning || generation !== this.generation)
      throw new Error('Wallet is closed.');
    const copies = createChatCopies(payment?.encoded ?? text, recipient.pubkey, this.privkeyBytes);
    const message: ChatMessage = {
      id: copies.rumor.id,
      conversation: normalizeNpub(identifier),
      direction: 'outgoing',
      createdAt: copies.rumor.created_at * 1000,
      receivedAt: Date.now(),
      text: payment ? payment.note || '' : text,
      ...(payment
        ? {
            paymentId: copies.rumor.id,
            paymentAmount: payment.amount,
            paymentType: payment.type,
            requestId: payment.requestId,
          }
        : {}),
      read: true,
      publication: 'sending',
      transport: 'nip17',
      envelopes: [
        { event: copies.recipient, relays: [] },
        { event: copies.sender, relays: getNostrInboxRelays() },
      ],
    };
    const { initService } =
      require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
    await initService.getRepo().messageRepository.insert(message);
    if (generation !== this.generation) throw new Error('Wallet is closed.');
    onQueued?.(message);
    await useMessageStore.getState().refresh();
    if (generation !== this.generation) throw new Error('Wallet is closed.');
    await this.retryChat(message);
  }

  public async sendRequest(
    identifier: string,
    encoded: string,
    requestId: string,
    amount: number,
    privateKey = this.privkeyHex || '',
  ): Promise<void> {
    const recipient = resolveNostrRecipient(identifier);
    const relays = [...new Set([...recipient.relayHints, ...getNostrRelays()])];
    const now = Date.now();
    const message: ChatMessage = {
      id: `request-${requestId}`,
      conversation: normalizeNpub(identifier),
      direction: 'outgoing',
      createdAt: now,
      receivedAt: now,
      text: '',
      read: true,
      publication: 'sending',
      transport: 'nip17',
      paymentId: `request-${requestId}`,
      paymentAmount: amount,
      paymentType: 'request',
      requestId,
    };
    const { initService } = require('./initService') as typeof import('./initService');
    const repository = initService.getRepo().messageRepository;
    await repository.insert(message);
    await useMessageStore.getState().refresh();
    try {
      if (!privateKey) throw new Error('Open and unlock your wallet to send this request.');
      const legacy = finalizeEvent(
        {
          kind: 4,
          created_at: Math.floor(now / 1000),
          tags: [['p', recipient.pubkey]],
          content: await nip04.encrypt(privateKey, recipient.pubkey, encoded),
        },
        hexToBytes(privateKey),
      );
      message.envelopes = [
        { event: legacy, relays },
        { event: createNip17GiftWrap(encoded, recipient.pubkey, privateKey), relays },
      ];
      await repository.setEnvelopes(message.id, message.envelopes);
      await this.retryChat(message);
    } catch (error) {
      await repository.setPublication(message.id, 'failed');
      await useMessageStore.getState().refresh();
      throw error;
    }
  }

  public async retryChat(message: ChatMessage): Promise<void> {
    if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
    if (message.requestId && !message.envelopes?.length && this.privkeyHex) {
      const { useNostrRequestStore } = await import('~/state/nostrRequestStore');
      await useNostrRequestStore.getState().loadPendingRequests();
      const request = useNostrRequestStore
        .getState()
        .requests.find((request) => request.id === message.requestId);
      if (!request || request.state !== 'pending')
        throw new Error('This request is no longer pending.');
      return this.sendRequest(
        message.conversation,
        request.creqString,
        request.id,
        request.amount,
        this.privkeyHex,
      );
    }
    const generation = this.generation;
    if (this.chatPublishing.has(message.id) || message.publication === 'sent') return;
    if (!this.isRunning || !this.pool || !message.envelopes?.length) {
      throw new Error('Open and unlock your wallet to retry this message.');
    }
    const { usePeopleStore } =
      require('~/state/peopleStore') as typeof import('~/state/peopleStore');
    if (usePeopleStore.getState().people[message.conversation]?.contactStatus === 'blocked') {
      throw new Error('Unblock this person in Nostr Settings first.');
    }
    const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
    const { useSettingsStore } =
      require('~/state/settingsStore') as typeof import('~/state/settingsStore');
    if (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated) {
      throw new Error('Unlock your wallet first.');
    }
    const { initService } =
      require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
    const repository = initService.getRepo().messageRepository;
    this.chatPublishing.add(message.id);
    try {
      await repository.setPublication(message.id, 'sending');
      await useMessageStore.getState().refresh();
      // Recipient acknowledgement determines success. Sender backup failure must not
      // misreport a successful recipient publication as a failed message.
      let [recipient, ...senderCopies] = message.envelopes;
      if (!recipient.relays.length) {
        const target = resolveNostrRecipient(message.conversation);
        const relays = await this.inboxRelays(target.pubkey);
        if (generation !== this.generation) return;
        recipient = { ...recipient, relays };
        await repository.setEnvelopes(message.id, [recipient, ...senderCopies]);
      }
      if (
        !this.pool ||
        generation !== this.generation ||
        usePeopleStore.getState().people[message.conversation]?.contactStatus === 'blocked' ||
        (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated)
      ) {
        throw new Error('Wallet or contact permission changed.');
      }
      if (
        message.requestId &&
        message.paymentType === 'request' &&
        message.envelopes[0].event.kind === 4
      ) {
        // Existing payment transports are alternatives, both addressed to the recipient.
        await Promise.any(
          message.envelopes.map((envelope) => publishChatEnvelope(this.pool!, envelope)),
        );
        senderCopies = [];
      } else await publishChatEnvelope(this.pool, recipient);
      if (generation !== this.generation) return;
      await repository.setPublication(message.id, 'sent');
      if (generation !== this.generation) return;
      if (usePeopleStore.getState().people[message.conversation]?.contactStatus !== 'blocked') {
        usePeopleStore.getState().setContactStatus(message.conversation, 'accepted');
      }
      if (this.pool)
        await Promise.allSettled(senderCopies.map((copy) => publishChatEnvelope(this.pool!, copy)));
    } catch (cause) {
      await repository.setPublication(message.id, 'failed');
      if (cause instanceof Error && cause.message.includes('no NIP-17 inbox relays')) throw cause;
      throw new Error('Message publication failed. Retry from this conversation when online.');
    } finally {
      this.chatPublishing.delete(message.id);
      if (this.isRunning && generation === this.generation)
        await useMessageStore.getState().refresh();
    }
  }
  private pool: SimplePool | null = null;
  private isRunning = false;
  private privkeyHex: string | null = null;
  private pubkeyHex: string | null = null;
  private privkeyBytes: Uint8Array | null = null;

  /** In-memory dedup cache. Cleared on stop. */
  private processedEvents = new Set<string>();

  /** Prevent duplicate relay deliveries from processing the same event concurrently. */
  private processingEvents = new Set<string>();

  /** AppState subscription reference */
  private appStateSub: any = null;

  /** Reconnect timer */
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  public start(privkeyHex: string, pubkeyHex: string, nip05?: string): void {
    if (this.isRunning) {
      console.log('[NostrService] Already running — restarting with fresh subscription');
      this._teardown();
    }

    this.privkeyHex = privkeyHex;
    this.pubkeyHex = pubkeyHex;
    this.privkeyBytes = hexToBytes(privkeyHex);
    this.isRunning = true;

    console.log(
      `[NostrService] Starting on ${getNostrRelays().length} relays for pubkey: ${pubkeyHex.slice(0, 8)}…`,
    );

    void this.initializeChat();
    this._subscribe();
    void this._publishInboxRelayList();
    if (nip05) {
      void this.publishProfile(nip05, privkeyHex, pubkeyHex);
    }
    this._startReconnectLoop();
    this._listenAppState();
  }

  public stop(): void {
    console.log('[NostrService] Stopping.');
    this._teardown();
  }

  public refresh(): void {
    if (!this.isRunning) return;
    void import('./requestLifecycleService')
      .then(({ requestLifecycleService }) => requestLifecycleService.reconcile())
      .catch(() => undefined);
    console.log('[NostrService] Manual refresh requested.');
    if (this.pool) {
      try {
        this.pool.close(this.connectedRelays);
      } catch {
        /* ignore */
      }
      this.pool = null;
    }
    this._subscribe();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _teardown(): void {
    this.generation++;
    this.subscription?.close();
    this.subscription = null;
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    if (this.pool) {
      try {
        this.pool.close(this.connectedRelays);
      } catch {
        /* ignore */
      }
      this.pool = null;
    }
    useMessageStore.getState().clear();
    this.processedEvents.clear();
    this.processingEvents.clear();
    this.isRunning = false;
    this.privkeyHex = null;
    this.pubkeyHex = null;
    this.privkeyBytes = null;
  }

  private _subscribe(): void {
    if (!this.pubkeyHex) return;
    this.subscription?.close();

    this.pool = new SimplePool();
    this.connectedRelays = getNostrRelays();

    // Subscribe to ALL relevant kinds simultaneously
    const filter: Filter = {
      kinds: LISTENED_KINDS,
      '#p': [this.pubkeyHex],
      since: Math.floor(Date.now() / 1000) - SINCE_SECONDS,
    };

    this.subscription = this.pool.subscribeMany(this.connectedRelays, filter, {
      onevent: (event: Event) => {
        this._processEvent(event).catch((error) => {
          console.warn(
            `[NostrService] Event ${event.id.slice(0, 8)}… escaped processing:`,
            error instanceof Error ? error.message : 'unknown error',
          );
        });
      },
      oneose: () => {
        console.log(
          '[NostrService] ✅ Initial EOSE — relay sync complete, listening for new events…',
        );
      },
    });

    console.log(
      `[NostrService] Subscribed to kinds [${LISTENED_KINDS.join(', ')}] across ${getNostrRelays().length} relays`,
    );
  }

  private _startReconnectLoop(): void {
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);

    this.reconnectTimer = setInterval(() => {
      if (!this.isRunning || !this.privkeyHex || !this.pubkeyHex) return;

      // Check if any relay is disconnected
      const statuses = this.pool?.listConnectionStatus?.();
      if (!statuses) return;

      const anyDisconnected = Array.from(statuses.values()).some((v) => v === false);
      if (anyDisconnected) {
        console.log('[NostrService] 🔄 Detected disconnected relay(s), refreshing subscription…');
        if (this.pool) {
          try {
            this.pool.close(this.connectedRelays);
          } catch {
            /* ignore */
          }
          this.pool = null;
        }
        this._subscribe();
      }
    }, RECONNECT_INTERVAL_MS);
  }

  private _listenAppState(): void {
    if (this.appStateSub) this.appStateSub.remove();

    this.appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (!this.isRunning) return;

      if (state === 'active') {
        console.log('[NostrService] App foregrounded — refreshing relay subscription');
        if (this.pool) {
          try {
            this.pool.close(this.connectedRelays);
          } catch {
            /* ignore */
          }
          this.pool = null;
        }
        this._subscribe();
      }
    });
  }

  // ── Event Processing ───────────────────────────────────────────────────────

  private async _processEvent(event: Event): Promise<void> {
    if (!this.privkeyHex || !this.pubkeyHex || !this.privkeyBytes) return;
    const generation = this.generation;
    if (this.processedEvents.has(event.id) || this.processingEvents.has(event.id)) return;
    this.processingEvents.add(event.id);

    try {
      // Skip our own outgoing events UNLESS it's a self-send (sender = recipient).
      // When you send to yourself, the event's author is you AND the #p tag is also you.
      if (event.pubkey === this.pubkeyHex) {
        const pTags = event.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
        const isSelfSend = pTags.includes(this.pubkeyHex!);
        if (!isSelfSend) {
          this.processedEvents.add(event.id);
          return; // Outgoing event to someone else — skip
        }
        // Self-send — continue processing as incoming payment
        console.log(
          `[NostrService] Self-send detected (event ${event.id.slice(0, 8)}…), processing as incoming`,
        );
      }

      console.log(
        `[NostrService] Event ${event.id.slice(0, 8)}… kind=${event.kind} from ${event.pubkey.slice(0, 8)}…`,
      );

      const decrypted = await this._decrypt(event);
      if (decrypted === null) {
        console.warn(
          `[NostrService] Event ${event.id.slice(0, 8)}… could not be decrypted; it remains retryable`,
        );
        return;
      }
      if (!this.privkeyHex || !this.pubkeyHex || generation !== this.generation) return;

      const outgoing =
        decrypted.senderPubkey === this.pubkeyHex && decrypted.recipients[0] !== this.pubkeyHex;
      const conversation = normalizeNpub(
        outgoing ? decrypted.recipients[0] : decrypted.senderPubkey,
      );
      if (isPaymentShaped(decrypted.text)) {
        // Sender copies of payments must never become incoming claims.
        await this._handleDecrypted(
          decrypted.text,
          { ...event, id: decrypted.id, created_at: decrypted.createdAt },
          decrypted.senderPubkey,
          generation,
          outgoing ? conversation : undefined,
        );
      } else if (decrypted.text.trim() && decrypted.text.length <= 16000) {
        const { initService } =
          require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
        if (generation !== this.generation) return;
        await initService.getRepo().messageRepository.insert({
          id: decrypted.id,
          conversation,
          direction: outgoing ? 'outgoing' : 'incoming',
          createdAt: decrypted.createdAt * 1000,
          receivedAt: Date.now(),
          text: decrypted.text,
          read: outgoing,
          publication: 'sent',
          transport: decrypted.transport,
        });
        if (generation !== this.generation) return;
        if (outgoing) {
          const { usePeopleStore } =
            require('~/state/peopleStore') as typeof import('~/state/peopleStore');
          if (usePeopleStore.getState().people[conversation]?.contactStatus !== 'blocked') {
            usePeopleStore.getState().setContactStatus(conversation, 'accepted');
          }
        } else applyIncomingContactPolicy(decrypted.senderPubkey);
        await useMessageStore.getState().refresh();
      }
      this.processedEvents.add(event.id);
    } catch (error) {
      console.warn(
        `[NostrService] Event ${event.id.slice(0, 8)}… processing failed; it remains retryable:`,
        error instanceof Error ? error.message : 'unknown error',
      );
    } finally {
      this.processingEvents.delete(event.id);
    }
  }

  /**
   * Attempt to decrypt an event and retain the authenticated sender identity.
   */
  private async _decrypt(event: Event) {
    return this.privkeyHex ? decryptAuthenticated(event, this.privkeyHex) : null;
  }

  /**
   * Persist incoming tokens and hand them to the automatic claim worker.
   * Unknown mints and terminal claim failures remain available for review.
   */
  private async _handleDecrypted(
    text: string,
    sourceEvent: Event,
    senderPubkey: string,
    generation = this.generation,
    outgoingConversation?: string,
  ): Promise<void> {
    if (text.length > MAX_NOSTR_PAYMENT_MESSAGE_LENGTH) {
      console.warn('[NostrService] Ignoring oversized payment message');
      return;
    }

    // ── 1. Check for incoming Payment Request (creqA / creqB) ──
    const creqMatch = text.match(/(creq[AB][A-Za-z0-9_=-]+)/i);
    if (creqMatch) {
      const creqString = creqMatch[1];
      console.log(
        `[NostrService] 🎉 Found incoming payment request in event ${sourceEvent.id.slice(0, 8)}…`,
      );
      try {
        const { PaymentRequest } = require('@cashu/cashu-ts') as typeof import('@cashu/cashu-ts');
        const pr = PaymentRequest.fromEncodedRequest(creqString);
        if (pr.amount && pr.mints && pr.mints.length > 0) {
          if (outgoingConversation) {
            if (Number.isSafeInteger(pr.amount) && pr.amount > 0) {
              const { useNostrRequestStore } = await import('~/state/nostrRequestStore');
              if (pr.id)
                await useNostrRequestStore.getState().addRequest({
                  id: pr.id,
                  mintUrl: pr.mints[0],
                  amount: pr.amount,
                  unit: pr.unit || 'sat',
                  creqString,
                  nostrPubkey: normalizeNpub(senderPubkey),
                  recipient: outgoingConversation,
                  description: pr.description,
                });
              await this.recordPaymentCopy(
                sourceEvent,
                outgoingConversation,
                pr.amount,
                'request',
                pr.id,
                pr.description,
              );
            }
            return;
          }
          const { useNostrInboxStore } = require('~/state/nostrInboxStore');
          const senderUsername = await this.getSenderUsername(senderPubkey);
          if (generation !== this.generation) return;

          const duplicate = useNostrInboxStore
            .getState()
            .items.some(
              (item: import('~/state/nostrInboxStore').NostrInboxItem) =>
                item.type === 'request' &&
                normalizeNpub(item.senderPubkey) === normalizeNpub(senderPubkey) &&
                ((!!pr.id && item.requestId === pr.id) || item.tokenString === creqString),
            );
          if (duplicate) return;
          useNostrInboxStore.getState().addIncoming({
            id: sourceEvent.id,
            type: 'request',
            requestId: pr.id,
            unit: pr.unit || 'sat',
            tokenString: creqString,
            amount: pr.amount,
            mintUrl: pr.mints[0],
            senderPubkey,
            senderUsername,
            note: pr.description,
          });
          applyIncomingContactPolicy(senderPubkey);
        }
      } catch {
        console.warn('[NostrService] Ignoring invalid payment request');
      }
      return; // Skip token parsing since it's a request
    }

    let tokenString = '';
    let amount = 0;
    let mintUrl = '';
    let requestIdFromPayload: string | undefined = undefined;
    let unit = 'sat';
    let note: string | undefined;

    // First try to parse a NUT-18 PaymentRequestPayload used by interoperable wallets.
    try {
      const payload = JSON.parse(text);
      if (
        payload &&
        Array.isArray(payload.proofs) &&
        payload.proofs.length > 0 &&
        typeof payload.mint === 'string'
      ) {
        console.log(
          `[NostrService] 🎉 Found JSON PaymentRequestPayload in event ${sourceEvent.id.slice(0, 8)}…`,
        );

        // Convert the payload to a V3 token, then pass it through the same decoder and
        // validation path used for cashuA/cashuB messages.
        const tokenStruct = {
          token: [{ mint: payload.mint, proofs: payload.proofs }],
          unit: typeof payload.unit === 'string' ? payload.unit : 'sat',
          memo: typeof payload.memo === 'string' ? payload.memo : undefined,
        };

        const b64 = Buffer.from(JSON.stringify(tokenStruct)).toString('base64');
        tokenString = `cashuA${b64}`;
        requestIdFromPayload = typeof payload.id === 'string' ? payload.id : undefined;
      }
    } catch {
      // Not JSON, fallback to regex search for cashuA/cashuB strings
    }

    if (!tokenString) {
      // Match V3 (cashuA) and V4 (cashuB) tokens
      const tokenMatch = text.match(/(cashu[AB][A-Za-z0-9+/_=-]+)/i);
      if (!tokenMatch) {
        return;
      }
      tokenString = tokenMatch[1];
      console.log(
        `[NostrService] 🎉 Found ecash token string in event ${sourceEvent.id.slice(0, 8)}…`,
      );
    }

    try {
      const decoded = decodeToken(tokenString);
      mintUrl = decoded.mint;
      amount = decoded.amount;
      unit = decoded.unit || 'sat';
      note = decoded.memo;
    } catch {
      console.warn(
        `[NostrService] Event ${sourceEvent.id.slice(0, 8)}… contained an invalid token`,
      );
      return;
    }

    if (
      tokenString.length > MAX_NOSTR_PAYMENT_MESSAGE_LENGTH ||
      !mintUrl ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      console.warn('[NostrService] Ignoring invalid payment token metadata');
      return;
    }

    console.log(`[NostrService] Token: ${amount} sat from mint ${mintUrl}`);

    if (outgoingConversation) {
      await this.recordPaymentCopy(
        sourceEvent,
        outgoingConversation,
        amount,
        'token',
        undefined,
        note,
      );
      return;
    }

    // Resolve sender username from local contacts or directory
    const senderUsername = await this.getSenderUsername(senderPubkey);
    if (generation !== this.generation) return;

    // Persist before emitting the UI event. DeviceEventEmitter is ephemeral,
    // so without this handoff a payment received off the Home tab can vanish.
    const { useNostrInboxStore } = require('~/state/nostrInboxStore');
    const added = useNostrInboxStore.getState().addIncoming({
      id: sourceEvent.id,
      type: 'token',
      tokenString,
      amount,
      mintUrl,
      senderPubkey,
      senderUsername,
      requestId: requestIdFromPayload,
      unit,
      note,
    });

    // Relays replay recent events whenever the app reconnects. A claimed or
    // dismissed inbox item is terminal, so do not enqueue or present it again.
    if (!added) return;

    // Claiming is owned by a non-React wallet service. Load it lazily to keep
    // the Nostr transport independent from wallet lifecycle modules.
    const { nostrClaimService } = require('~/services/wallet/nostrClaimService');
    const claimResult = await nostrClaimService.enqueue(sourceEvent.id);

    // The claim sheet reviews unknown mints or terminal errors; successful
    // automatic claims do not need a confirmation prompt.
    DeviceEventEmitter.emit('nostr:incoming', {
      eventId: sourceEvent.id,
      tokenString,
      amount,
      mintUrl,
      senderPubkey,
      senderUsername,
      requestId: requestIdFromPayload,
    });
    console.log('[NostrService] Incoming payment handled', {
      eventId: sourceEvent.id,
      category: claimResult?.status || 'saved',
    });
  }

  private async recordPaymentCopy(
    event: Event,
    conversation: string,
    amount: number,
    type: 'token' | 'request',
    requestId?: string,
    note?: string,
  ): Promise<void> {
    const generation = this.generation;
    const { initService } =
      require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
    if (
      requestId &&
      (await initService.getRepo().messageRepository.findRequest(conversation, requestId))
    )
      return;
    await initService.getRepo().messageRepository.insert({
      id: event.id,
      conversation,
      direction: 'outgoing',
      createdAt: event.created_at * 1000,
      receivedAt: Date.now(),
      text: note || '',
      read: true,
      publication: 'sent',
      transport: 'nip17',
      paymentId: event.id,
      paymentAmount: amount,
      paymentType: type,
      requestId,
    });
    if (generation !== this.generation) return;
    const { usePeopleStore } =
      require('~/state/peopleStore') as typeof import('~/state/peopleStore');
    if (usePeopleStore.getState().people[conversation]?.contactStatus !== 'blocked') {
      usePeopleStore.getState().setContactStatus(conversation, 'accepted');
    }
    await useMessageStore.getState().refresh();
  }

  /** Advertise the relays where other NIP-17 clients should deliver gift wraps. */
  private async _publishInboxRelayList(): Promise<boolean> {
    if (!this.privkeyBytes || !this.pool) return false;

    const event = finalizeEvent(
      {
        kind: 10050,
        created_at: Math.floor(Date.now() / 1000),
        tags: getNostrInboxRelays().map((relay) => ['relay', relay]),
        content: '',
      },
      this.privkeyBytes,
    );

    try {
      await Promise.any(this.pool.publish(getNostrRelays(), event));
      console.log('[NostrService] Published NIP-17 inbox relay preference.');
      return true;
    } catch (err: any) {
      console.warn(
        '[NostrService] Could not publish NIP-17 inbox relay preference:',
        err?.message || err,
      );
      return false;
    }
  }

  public republishInboxRelayList(): Promise<boolean> {
    return this._publishInboxRelayList();
  }

  public reconnectRelays(): void {
    this.refresh();
  }

  public getRelayConnectionStatus(): Record<string, boolean> {
    const statuses = this.pool?.listConnectionStatus?.();
    const normalized = new Map(
      Array.from(statuses ?? [], ([url, connected]) => [normalizeRelayUrl(url), connected]),
    );
    return Object.fromEntries(
      getNostrRelays().map((relay) => [relay, normalized.get(relay) === true]),
    );
  }

  /**
   * Build a signed kind-0 profile while preserving metadata already published
   * by another Nostr client. The Bey address is always authoritative.
   */
  public async createProfileEvent(
    nip05: string,
    privkeyHex: string,
    pubkeyHex: string,
  ): Promise<Event> {
    const privkeyBytes = hexToBytes(privkeyHex);
    if (getPublicKey(privkeyBytes) !== pubkeyHex.toLowerCase()) {
      throw new Error('Nostr profile key mismatch');
    }

    const normalizedNip05 = nip05.trim().toLowerCase();
    const [username, domain, ...extraParts] = normalizedNip05.split('@');
    if (
      !username ||
      domain !== 'bey.cash' ||
      extraParts.length > 0 ||
      !/^[a-z0-9_.-]{1,64}$/.test(username)
    ) {
      throw new Error('Invalid bey.cash NIP-05 identifier');
    }

    const existing = await this._fetchProfileMetadata(pubkeyHex);
    const displayName =
      typeof existing.display_name === 'string'
        ? existing.display_name
        : typeof existing.displayName === 'string'
          ? existing.displayName
          : username;

    return finalizeEvent(
      {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          ...existing,
          name: typeof existing.name === 'string' ? existing.name : username,
          display_name: displayName,
          nip05: normalizedNip05,
        }),
      },
      privkeyBytes,
    );
  }

  /** Publish an already signed profile to every relay advertised by bey.cash. */
  public async publishProfileEvent(profileEvent: Event): Promise<boolean> {
    const pool = this.pool ?? new SimplePool();
    const ownsPool = this.pool === null;
    const relays = getNostrInboxRelays();

    try {
      await Promise.any(pool.publish(relays, profileEvent));
      console.log('[NostrService] Published Nostr kind-0 profile.');
      return true;
    } catch (err: any) {
      console.warn('[NostrService] Could not publish Nostr profile:', err?.message || err);
      return false;
    } finally {
      if (ownsPool) pool.close(relays);
    }
  }

  /** Create and publish/repair the profile associated with a Bey username. */
  public async publishProfile(
    nip05: string,
    privkeyHex: string,
    pubkeyHex: string,
  ): Promise<boolean> {
    try {
      const profileEvent = await this.createProfileEvent(nip05, privkeyHex, pubkeyHex);
      return this.publishProfileEvent(profileEvent);
    } catch (err: any) {
      console.warn('[NostrService] Could not create Nostr profile:', err?.message || err);
      return false;
    }
  }

  private async _fetchProfileMetadata(pubkeyHex: string): Promise<Record<string, unknown>> {
    const pool = this.pool ?? new SimplePool();
    const ownsPool = this.pool === null;
    const relays = getNostrInboxRelays();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const events = await Promise.race([
        pool.querySync(relays, {
          authors: [pubkeyHex],
          kinds: [0],
          limit: 8,
        }),
        new Promise<Event[]>((resolve) => {
          timeout = setTimeout(() => resolve([]), 5_000);
        }),
      ]);
      const newest = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!newest) return {};

      const metadata = JSON.parse(newest.content);
      return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    } catch {
      return {};
    } finally {
      if (timeout) clearTimeout(timeout);
      if (ownsPool) pool.close(relays);
    }
  }

  private async getSenderUsername(pubkeyHex: string): Promise<string | undefined> {
    try {
      const { usePeopleStore } =
        require('~/state/peopleStore') as typeof import('~/state/peopleStore');
      const { nip19 } = require('nostr-tools') as typeof import('nostr-tools');

      const npub = nip19.npubEncode(pubkeyHex);

      const store = usePeopleStore.getState();
      const contact = store.people[npub];
      if (contact?.username) {
        return contact.username;
      }
    } catch (e) {
      console.warn('[NostrService] Failed local contact username lookup:', e);
    }
    return this.resolveUsername(pubkeyHex);
  }

  // ── Username Resolution ──────────────────────────────────────────────────

  /**
   * Resolve a hex pubkey to a bey.cash username (NIP-05 directory lookup).
   * Returns undefined if not found.
   */
  public async resolveUsername(hexPubkey: string): Promise<string | undefined> {
    try {
      const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
      if (!res.ok) return undefined;
      const data = await res.json();
      if (!data?.names) return undefined;

      for (const [name, pubkey] of Object.entries(data.names)) {
        if ((pubkey as string).toLowerCase() === hexPubkey.toLowerCase()) {
          return `${name}@bey.cash`;
        }
      }
    } catch {
      // Network error — non-fatal
    }
    return undefined;
  }

  // ── Sending via Nostr ──────────────────────────────────────────────────────

  /**
   * Send a cashu token / payment payload to a recipient via Nostr DM.
   * Dual-publishes using both NIP-04 (Kind 4) and NIP-17 (Kind 1059 Gift Wrap)
   * so all Nostr wallets (cashu.me, minibits, nutsack, etc.) receive the payment.
   *
   * @param tokenString   Encoded cashu token or JSON payment payload string
   * @param recipientPubkeyHexOrNpub  Recipient's hex pubkey or npub
   * @param senderPrivkeyHex  Sender's Nostr private key (hex)
   * @returns true if published to at least one relay
   */
  public async sendViaNostr(
    tokenString: string,
    recipientPubkeyHexOrNpub: string,
    senderPrivkeyHex: string,
  ): Promise<boolean> {
    if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
    const { usePeopleStore } =
      require('~/state/peopleStore') as typeof import('~/state/peopleStore');
    if (
      usePeopleStore.getState().people[normalizeNpub(recipientPubkeyHexOrNpub)]?.contactStatus ===
      'blocked'
    ) {
      throw new Error('Unblock this person in Nostr Settings first.');
    }
    // Resolve npub/nprofile → hex
    let recipient: ReturnType<typeof resolveNostrRecipient>;
    try {
      recipient = resolveNostrRecipient(recipientPubkeyHexOrNpub);
    } catch (e: any) {
      throw new Error(`Invalid Nostr identifier: ${e.message}`);
    }
    const recipientPubkeyHex = recipient.pubkey;
    const publishRelays = [...new Set([...recipient.relayHints, ...getNostrRelays()])];

    const senderPrivkeyBytes = hexToBytes(senderPrivkeyHex);

    // Build NIP-04 Event
    const encryptedContent = await nip04.encrypt(senderPrivkeyHex, recipientPubkeyHex, tokenString);
    const nip04Event = finalizeEvent(
      {
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkeyHex]],
        content: encryptedContent,
      },
      senderPrivkeyBytes,
    );

    // Build NIP-17 Gift Wrap Event
    let nip17Event: Event | null = null;
    try {
      nip17Event = createNip17GiftWrap(tokenString, recipientPubkeyHex, senderPrivkeyHex);
    } catch (e) {
      console.warn('[NostrService] Failed to construct NIP-17 gift wrap:', e);
    }

    const ownsPool = this.pool === null;
    const pool = this.pool ?? new SimplePool();

    console.log(
      `[NostrService] 📤 Sending token via Nostr DM (NIP-04 & NIP-17) to ${recipientPubkeyHex.slice(0, 8)}… on ${publishRelays.length} relays`,
    );

    try {
      const publishAttempts: Promise<unknown>[] = [
        Promise.any(pool.publish(publishRelays, nip04Event).map(requireRelayAcknowledgement)),
      ];
      if (nip17Event) {
        publishAttempts.push(
          Promise.any(pool.publish(publishRelays, nip17Event).map(requireRelayAcknowledgement)),
        );
      }

      const published = await hasSuccessfulRelayPublish(publishAttempts);
      if (!published) {
        console.error('[NostrService] Failed to publish token to any relay.');
        return false;
      }

      console.log(`[NostrService] ✅ Token published via Nostr.`);

      // Publication is the acceptance boundary; do not let later claim work
      // turn a successfully published payment into a reported send failure.
      const { usePeopleStore } =
        require('~/state/peopleStore') as typeof import('~/state/peopleStore');
      if (
        usePeopleStore.getState().people[normalizeNpub(recipientPubkeyHex)]?.contactStatus !==
        'blocked'
      ) {
        usePeopleStore.getState().setContactStatus(recipientPubkeyHex, 'accepted');
      }

      // Emit event for UI
      DeviceEventEmitter.emit('nostr:sent', {
        eventId: nip04Event.id,
        recipientPubkeyHex,
      });

      return true;
    } catch (err: any) {
      console.error('[NostrService] Failed to publish token to any relay:', err?.message || err);
      return false;
    } finally {
      if (ownsPool) {
        pool.close(publishRelays);
      }
    }
  }

  // ── Mint Backup & Restore (NIP-61 / Kind 10019) ──────────────────────────

  /**
   * Publish a NIP-61 compliant kind 10019 (Nutzap info) event.
   * This advertises the user's active mints and serves as a backup mechanism.
   * Compatible with cashu.me and other standard NIP-60/61 wallets.
   */
  public async backupMintsToNostr(
    mints: string[],
    privkeyHex: string,
    pubkeyHex: string,
  ): Promise<boolean> {
    const privkeyBytes = hexToBytes(privkeyHex);

    // Create ["mint", "<url>"] tags for each mint
    const tags = mints.map((url) => ['mint', url]);

    const eventTemplate = {
      kind: 10019,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: '', // Public informational event, content is usually empty
    };

    const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
    const relays = getNostrRelays();
    const ownsPool = !this.pool;
    const pool = this.pool ?? new SimplePool();

    console.log(
      `[NostrService] 📤 Backing up ${mints.length} mints to Nostr (Kind 10019) on ${getNostrRelays().length} relays…`,
    );

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.any(pool.publish(relays, signedEvent)),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Mint backup confirmation timed out.')),
            15_000,
          );
        }),
      ]);
      console.log(`[NostrService] ✅ Mints backed up. Event: ${signedEvent.id}`);
      return true;
    } catch (err: any) {
      console.error('[NostrService] Failed to backup mints to Nostr:', err?.message || err);
      return false;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (ownsPool) pool.close(relays);
    }
  }

  /**
   * Fetch the user's NIP-61 kind 10019 event to retrieve their backed-up mints.
   */
  public async fetchMintsFromNostr(pubkeyHex: string): Promise<string[]> {
    console.log(`[NostrService] 📥 Fetching mints from Nostr for pubkey ${pubkeyHex.slice(0, 8)}…`);
    const pool = new SimplePool();
    const relays = getNostrRelays();

    try {
      const filter: Filter = {
        authors: [pubkeyHex],
        kinds: [10019],
        limit: 1, // Get the most recent one
      };

      const events = await pool.querySync(relays, filter);

      if (!events || events.length === 0) {
        console.log('[NostrService] No mint backup found on Nostr.');
        return [];
      }

      // Sort by newest
      events.sort((a, b) => b.created_at - a.created_at);
      const latestEvent = events[0];

      // Extract mint URLs from ["mint", "url"] tags
      const mintUrls = latestEvent.tags
        .filter((tag) => tag[0] === 'mint' && typeof tag[1] === 'string')
        .map((tag) => tag[1]);

      console.log(`[NostrService] ✅ Recovered ${mintUrls.length} mints from Nostr backup.`);
      return mintUrls;
    } catch (err: any) {
      console.error('[NostrService] Failed to fetch mints from Nostr:', err?.message || err);
      return [];
    } finally {
      pool.close(relays);
    }
  }

  // ── NIP-60 Wallet Encrypted Proof Backup (Kind 37375) ──────────────────────

  /**
   * Publish NIP-60 compliant kind 37375 event.
   * Encrypts active tokens/proofs with NIP-44 to self and backs up to Nostr relays.
   */
  public async backupWalletStateToNostr(
    walletData: any,
    privkeyHex: string,
    pubkeyHex: string,
  ): Promise<boolean> {
    try {
      const privkeyBytes = hexToBytes(privkeyHex);
      const conversationKey = nip44.v2.utils.getConversationKey(privkeyBytes, pubkeyHex);
      const plaintext = JSON.stringify(walletData);
      const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);

      const eventTemplate = {
        kind: 37375,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', 'cashu-wallet-backup']],
        content: ciphertext,
      };

      const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
      const pool = this.pool ?? new SimplePool();

      console.log(
        `[NostrService] 📤 Backing up encrypted NIP-60 wallet state (Kind 37375) to Nostr relays…`,
      );
      await Promise.any(pool.publish(getNostrRelays(), signedEvent));
      console.log(`[NostrService] ✅ NIP-60 Wallet state backed up. Event: ${signedEvent.id}`);
      return true;
    } catch (err: any) {
      console.error('[NostrService] Failed NIP-60 wallet state backup:', err?.message || err);
      return false;
    }
  }

  /**
   * Fetch and decrypt NIP-60 kind 37375 event to recover backed-up wallet state.
   */
  public async fetchWalletStateFromNostr(
    privkeyHex: string,
    pubkeyHex: string,
  ): Promise<any | null> {
    console.log(`[NostrService] 📥 Fetching NIP-60 wallet state from Nostr…`);
    const pool = new SimplePool();
    const relays = getNostrRelays();

    try {
      const filter: Filter = {
        authors: [pubkeyHex],
        kinds: [37375],
        '#d': ['cashu-wallet-backup'],
        limit: 1,
      };

      const events = await pool.querySync(relays, filter);
      if (!events || events.length === 0) {
        console.log('[NostrService] No NIP-60 wallet backup found on Nostr.');
        return null;
      }

      events.sort((a, b) => b.created_at - a.created_at);
      const latestEvent = events[0];

      const privkeyBytes = hexToBytes(privkeyHex);
      const conversationKey = nip44.v2.utils.getConversationKey(privkeyBytes, pubkeyHex);
      const decryptedText = nip44.v2.decrypt(latestEvent.content, conversationKey);
      const walletData = JSON.parse(decryptedText);

      console.log('[NostrService] ✅ Successfully recovered and decrypted NIP-60 wallet state.');
      return walletData;
    } catch (err: any) {
      console.error('[NostrService] Failed NIP-60 wallet state recovery:', err?.message || err);
      return null;
    } finally {
      pool.close(relays);
    }
  }
}

export const nostrService = new NostrService();

/**
 * Standalone helper — send a cashu token to a recipient via Nostr DM.
 * Resolves npub → hex automatically.
 */
export async function sendNostrToken(
  tokenString: string,
  recipientPubkeyHexOrNpub: string,
  senderPrivkeyHex: string,
): Promise<boolean> {
  return nostrService.sendViaNostr(tokenString, recipientPubkeyHexOrNpub, senderPrivkeyHex);
}
