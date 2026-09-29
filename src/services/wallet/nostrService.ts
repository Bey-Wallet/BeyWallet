import { SimplePool, type Filter, type Event, nip04, nip44, finalizeEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { unwrapEvent } from 'nostr-tools/nip59';
import { hexToBytes } from '@noble/hashes/utils.js';
import { decode as nip19Decode } from 'nostr-tools/nip19';
import { Buffer } from 'buffer';
import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
// Removed top level walletService import to break require cycle.
import { decodeToken } from '~/services/wallet/tokenUtils';
import { nostrRequestStore } from '~/state/nostrRequestStore';

// ─── Relay List ───────────────────────────────────────────────────────────────
//
// Comprehensive list of relays used by the major Cashu/Nostr wallets:
//   - cashu.me PWA          → relay.primal.net, relay.damus.io, nostr.oxtr.dev,
//                              relay.snort.social, nos.lol, nostr.wine
//   - Minibits               → relay.minibits.cash, relay.primal.net, relay.damus.io,
//                              relay.nostr.band, relay.noswhere.com
//   - Common / fallback      → nostr.bitcoiner.social, relay.current.fyi,
//                              relay.nostr.jabber.ch
//
export const RELAYS: string[] = [
  // ── Core / high-uptime ───────────────────────────────────────────────
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  // ── Minibits dedicated relay ─────────────────────────────────────────
  'wss://relay.minibits.cash',
  // ── cashu.me preferred relays ────────────────────────────────────────
  'wss://nostr.oxtr.dev',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  // ── Search / discovery relays ────────────────────────────────────────
  'wss://relay.nostr.band',
  'wss://relay.noswhere.com',
  // ── Broader ecosystem ────────────────────────────────────────────────
  'wss://nostr.bitcoiner.social',
  'wss://relay.current.fyi',
  'wss://relay.8333.space',
];

// Public inbox relays advertised via NIP-17 kind 10050. Keep this list small
// and aligned with the relay hints returned by bey.cash NIP-05 responses.
export const NIP17_INBOX_RELAYS: string[] = [
  'wss://relay.minibits.cash',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

// ─── Event Kinds ──────────────────────────────────────────────────────────────
//
// Kind 4    — NIP-04 Legacy encrypted DM  (cashu.me legacy, some wallets)
// Kind 13   — NIP-17 "Sealed DM" (inner event, encrypted with NIP-44)
// Kind 14   — NIP-17 Private DM  (inner event, encrypted with NIP-44)
// Kind 1059 — NIP-59 Gift-Wrap outer event (wraps Kind 13/14)
//
const LISTENED_KINDS = [4, 13, 14, 1059];

// How many seconds back to fetch on first connection
const SINCE_SECONDS = 7 * 24 * 60 * 60; // Recover messages after several days offline
const MAX_NOSTR_PAYMENT_MESSAGE_LENGTH = 64 * 1024;

interface DecryptedNostrMessage {
  text: string;
  senderPubkey: string;
}

// Reconnect interval when the pool drops
const RECONNECT_INTERVAL_MS = 30_000;

/**
 * Background Nostr listener for incoming Cashu ecash payments.
 *
 * Supports:
 * - NIP-04 Kind 4  (legacy, used by older wallets)
 * - NIP-17 Kind 14 in Kind 1059 gift-wrap (used by minibits ≥ v0.1.5)
 * - NIP-44 Kind 1059 direct (used by some cashu.me variants)
 *
 * Both V3 (cashuA) and V4 (cashuB) token patterns are recognized.
 */
class NostrService {
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
      `[NostrService] Starting on ${RELAYS.length} relays for pubkey: ${pubkeyHex.slice(0, 8)}…`,
    );

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
    console.log('[NostrService] Manual refresh requested.');
    if (this.pool) {
      try {
        this.pool.close(RELAYS);
      } catch {
        /* ignore */
      }
      this.pool = null;
    }
    this._subscribe();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _teardown(): void {
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
        this.pool.close(RELAYS);
      } catch {
        /* ignore */
      }
      this.pool = null;
    }
    this.processedEvents.clear();
    this.processingEvents.clear();
    this.isRunning = false;
    this.privkeyHex = null;
    this.pubkeyHex = null;
    this.privkeyBytes = null;
  }

  private _subscribe(): void {
    if (!this.pubkeyHex) return;

    this.pool = new SimplePool();

    // Subscribe to ALL relevant kinds simultaneously
    const filter: Filter = {
      kinds: LISTENED_KINDS,
      '#p': [this.pubkeyHex],
      since: Math.floor(Date.now() / 1000) - SINCE_SECONDS,
    };

    this.pool.subscribeMany(RELAYS, filter, {
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
      `[NostrService] Subscribed to kinds [${LISTENED_KINDS.join(', ')}] across ${RELAYS.length} relays`,
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
            this.pool.close(RELAYS);
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
            this.pool.close(RELAYS);
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

      await this._handleDecrypted(decrypted.text, event, decrypted.senderPubkey);
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
  private async _decrypt(event: Event): Promise<DecryptedNostrMessage | null> {
    if (!this.privkeyHex || !this.privkeyBytes) return null;

    // ── Kind 4: NIP-04 legacy encrypted DM ──────────────────────────────
    if (event.kind === 4) {
      try {
        return {
          text: await nip04.decrypt(this.privkeyHex, event.pubkey, event.content),
          senderPubkey: event.pubkey,
        };
      } catch {
        return null;
      }
    }

    // ── Kind 1059: NIP-59 Gift-Wrap (outer) ──────────────────────────────
    // Unwrap using NIP-59 to get the inner sealed event (Kind 13 or 14)
    if (event.kind === 1059) {
      try {
        const rumor = unwrapEvent(event, this.privkeyBytes);
        // unwrapEvent verifies/decrypts the seal and returns the kind 14 rumor.
        // Its pubkey is the real sender; the outer event uses a throwaway key.
        if (rumor.kind === 14) {
          return { text: rumor.content, senderPubkey: rumor.pubkey };
        }
        // Fallback for non-standard wraps that expose another encrypted event.
        const convKey = nip44.v2.utils.getConversationKey(this.privkeyBytes, rumor.pubkey);
        return {
          text: nip44.v2.decrypt(rumor.content, convKey),
          senderPubkey: rumor.pubkey,
        };
      } catch {
        return null;
      }
    }

    // ── Kind 14: NIP-17 Private DM (direct, no outer gift-wrap) ─────────
    if (event.kind === 14 || event.kind === 13) {
      try {
        const convKey = nip44.v2.utils.getConversationKey(this.privkeyBytes, event.pubkey);
        return {
          text: nip44.v2.decrypt(event.content, convKey),
          senderPubkey: event.pubkey,
        };
      } catch {
        // Also try NIP-04 as fallback
        try {
          return {
            text: await nip04.decrypt(this.privkeyHex, event.pubkey, event.content),
            senderPubkey: event.pubkey,
          };
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Handle decrypted message content — queue cashu tokens for manual claiming.
   *
   * Instead of auto-receiving, we emit 'nostr:incoming' so the UI can show
   * a claim sheet where the user inspects mint, fees, and sender info before
   * accepting the payment.
   */
  private async _handleDecrypted(
    text: string,
    sourceEvent: Event,
    senderPubkey: string,
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
        const { PaymentRequest } = await import('@cashu/cashu-ts');
        const pr = PaymentRequest.fromEncodedRequest(creqString);
        if (pr.amount && pr.mints && pr.mints.length > 0) {
          const { useNostrInboxStore } = require('~/state/nostrInboxStore');
          const senderUsername = await this.getSenderUsername(senderPubkey);

          useNostrInboxStore.getState().addIncoming({
            id: sourceEvent.id,
            type: 'request',
            tokenString: creqString,
            amount: pr.amount,
            mintUrl: pr.mints[0],
            senderPubkey,
            senderUsername,
          });
        }
      } catch (e) {
        console.warn(`[NostrService] Failed to parse creq string:`, e);
      }
      return; // Skip token parsing since it's a request
    }

    let tokenString = '';
    let amount = 0;
    let mintUrl = '';
    let requestIdFromPayload: string | undefined = undefined;

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
      const tokenMatch = text.match(/(cashu[AB][A-Za-z0-9_=-]+)/i);
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

    console.log(`[NostrService] Token: ${amount} sats from mint ${mintUrl}`);

    // Resolve sender username from local contacts or directory
    const senderUsername = await this.getSenderUsername(senderPubkey);

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
    });

    // Relays replay recent events whenever the app reconnects. A claimed or
    // dismissed inbox item is terminal, so do not enqueue or present it again.
    if (!added) return;

    // Claiming is owned by a non-React wallet service. Load it lazily to keep
    // the Nostr transport independent from wallet lifecycle modules.
    const { nostrClaimService } = require('~/services/wallet/nostrClaimService');
    await nostrClaimService.enqueue(sourceEvent.id);

    // ── Queue for manual claim via NostrClaimSheet ──────────────────────
    // Emit 'nostr:incoming' so the UI can present a claim sheet where the
    // user inspects the mint, amount, fees, and sender before accepting.
    DeviceEventEmitter.emit('nostr:incoming', {
      eventId: sourceEvent.id,
      tokenString,
      amount,
      mintUrl,
      senderPubkey,
      senderUsername,
      requestId: requestIdFromPayload,
    });
    console.log(
      `[NostrService] 🔔 Queued incoming payment for manual claim: ${amount} sats from ${senderPubkey.slice(0, 8)}…`,
    );
  }

  /** Advertise the relays where other NIP-17 clients should deliver gift wraps. */
  private async _publishInboxRelayList(): Promise<boolean> {
    if (!this.privkeyBytes || !this.pool) return false;

    const event = finalizeEvent(
      {
        kind: 10050,
        created_at: Math.floor(Date.now() / 1000),
        tags: NIP17_INBOX_RELAYS.map((relay) => ['relay', relay]),
        content: '',
      },
      this.privkeyBytes,
    );

    try {
      await Promise.any(this.pool.publish(RELAYS, event));
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
    return Object.fromEntries(RELAYS.map((relay) => [relay, statuses?.get(relay) === true]));
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

    try {
      await Promise.any(pool.publish(NIP17_INBOX_RELAYS, profileEvent));
      console.log('[NostrService] Published Nostr kind-0 profile.');
      return true;
    } catch (err: any) {
      console.warn('[NostrService] Could not publish Nostr profile:', err?.message || err);
      return false;
    } finally {
      if (ownsPool) pool.close(NIP17_INBOX_RELAYS);
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
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const events = await Promise.race([
        pool.querySync(NIP17_INBOX_RELAYS, {
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
      if (ownsPool) pool.close(NIP17_INBOX_RELAYS);
    }
  }

  private async getSenderUsername(pubkeyHex: string): Promise<string | undefined> {
    try {
      const { usePeopleStore } = await import('~/state/peopleStore');
      const { nip19 } = await import('nostr-tools');

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
   * Helper to build a NIP-17 Gift Wrap event (Kind 1059 wrapping Kind 13 Seal wrapping Kind 14 Rumor).
   * Used by cashu.me and modern Nostr wallets for direct message subscriptions.
   */
  private async createNip17GiftWrap(
    message: string,
    recipientPubkeyHex: string,
    senderPrivkeyHex: string,
  ): Promise<Event> {
    const senderPrivkeyBytes = hexToBytes(senderPrivkeyHex);
    const senderPubkeyHex = getPublicKey(senderPrivkeyBytes);

    // 1. Rumor (Kind 14) - Unsigned inner DM
    const rumor = {
      kind: 14,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: senderPubkeyHex,
      tags: [['p', recipientPubkeyHex]],
      content: message,
    };
    const rumorString = JSON.stringify(rumor);

    // 2. Seal (Kind 13) - Encrypted with sender <-> recipient key & signed by sender
    const sealConvKey = nip44.v2.utils.getConversationKey(senderPrivkeyBytes, recipientPubkeyHex);
    const encryptedRumor = nip44.v2.encrypt(rumorString, sealConvKey);

    const sealTemplate = {
      kind: 13,
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 10),
      pubkey: senderPubkeyHex,
      tags: [],
      content: encryptedRumor,
    };
    const signedSeal = finalizeEvent(sealTemplate, senderPrivkeyBytes);
    const sealString = JSON.stringify(signedSeal);

    // 3. Gift Wrap (Kind 1059) - Encrypted with ephemeral random key & signed by ephemeral key
    const ephemeralPrivkeyBytes = generateSecretKey();
    const ephemeralPubkeyHex = getPublicKey(ephemeralPrivkeyBytes);
    const wrapConvKey = nip44.v2.utils.getConversationKey(
      ephemeralPrivkeyBytes,
      recipientPubkeyHex,
    );
    const encryptedSeal = nip44.v2.encrypt(sealString, wrapConvKey);

    const randomPastTime = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400);

    const wrapTemplate = {
      kind: 1059,
      created_at: randomPastTime,
      pubkey: ephemeralPubkeyHex,
      tags: [['p', recipientPubkeyHex]],
      content: encryptedSeal,
    };

    return finalizeEvent(wrapTemplate, ephemeralPrivkeyBytes);
  }

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
    // Resolve npub/nprofile → hex
    let recipientPubkeyHex = recipientPubkeyHexOrNpub.trim();
    if (recipientPubkeyHex.startsWith('npub') || recipientPubkeyHex.startsWith('nprofile')) {
      try {
        const decoded = nip19Decode(recipientPubkeyHex);
        if (decoded.type === 'npub') {
          recipientPubkeyHex = decoded.data as string;
        } else if (decoded.type === 'nprofile') {
          recipientPubkeyHex = (decoded.data as any).pubkey as string;
        } else {
          throw new Error('Unsupported bech32 prefix');
        }
      } catch (e: any) {
        throw new Error(`Invalid Nostr identifier: ${e.message}`);
      }
    }

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
      nip17Event = await this.createNip17GiftWrap(
        tokenString,
        recipientPubkeyHex,
        senderPrivkeyHex,
      );
    } catch (e) {
      console.warn('[NostrService] Failed to construct NIP-17 gift wrap:', e);
    }

    const pool = this.pool ?? new SimplePool();

    console.log(
      `[NostrService] 📤 Sending token via Nostr DM (NIP-04 & NIP-17) to ${recipientPubkeyHex.slice(0, 8)}… on ${RELAYS.length} relays`,
    );

    try {
      const promises = [Promise.any(pool.publish(RELAYS, nip04Event))];
      if (nip17Event) {
        promises.push(Promise.any(pool.publish(RELAYS, nip17Event)));
      }
      await Promise.allSettled(promises);
      console.log(`[NostrService] ✅ Token published via Nostr.`);

      // Emit event for UI
      DeviceEventEmitter.emit('nostr:sent', {
        eventId: nip04Event.id,
        recipientPubkeyHex,
      });

      return true;
    } catch (err: any) {
      console.error('[NostrService] Failed to publish token to any relay:', err?.message || err);
      return false;
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
    const pool = this.pool ?? new SimplePool();

    console.log(
      `[NostrService] 📤 Backing up ${mints.length} mints to Nostr (Kind 10019) on ${RELAYS.length} relays…`,
    );

    try {
      await Promise.any(pool.publish(RELAYS, signedEvent));
      console.log(`[NostrService] ✅ Mints backed up. Event: ${signedEvent.id}`);
      return true;
    } catch (err: any) {
      console.error('[NostrService] Failed to backup mints to Nostr:', err?.message || err);
      return false;
    }
  }

  /**
   * Fetch the user's NIP-61 kind 10019 event to retrieve their backed-up mints.
   */
  public async fetchMintsFromNostr(pubkeyHex: string): Promise<string[]> {
    console.log(`[NostrService] 📥 Fetching mints from Nostr for pubkey ${pubkeyHex.slice(0, 8)}…`);
    const pool = new SimplePool();

    try {
      const filter: Filter = {
        authors: [pubkeyHex],
        kinds: [10019],
        limit: 1, // Get the most recent one
      };

      const events = await pool.querySync(RELAYS, filter);

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
      pool.close(RELAYS);
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
      await Promise.any(pool.publish(RELAYS, signedEvent));
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

    try {
      const filter: Filter = {
        authors: [pubkeyHex],
        kinds: [37375],
        '#d': ['cashu-wallet-backup'],
        limit: 1,
      };

      const events = await pool.querySync(RELAYS, filter);
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
      pool.close(RELAYS);
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
