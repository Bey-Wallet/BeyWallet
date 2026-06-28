import {
  SimplePool,
  type Filter,
  type Event,
  nip04,
  nip44,
  finalizeEvent,
} from 'nostr-tools';
import { unwrapEvent } from 'nostr-tools/nip59';
import { hexToBytes } from '@noble/hashes/utils';
import { decode as nip19Decode } from 'nostr-tools/nip19';
import { Buffer } from 'buffer';
import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
// Removed top level walletService import to break require cycle.
import { cleanToken } from './tokenUtils';
import { getDecodedToken } from '@cashu/cashu-ts';
import { nostrRequestStore } from '../../store/nostrRequestStore';

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

// ─── Event Kinds ──────────────────────────────────────────────────────────────
//
// Kind 4    — NIP-04 Legacy encrypted DM  (cashu.me legacy, some wallets)
// Kind 13   — NIP-17 "Sealed DM" (inner event, encrypted with NIP-44)
// Kind 14   — NIP-17 Private DM  (inner event, encrypted with NIP-44)
// Kind 1059 — NIP-59 Gift-Wrap outer event (wraps Kind 13/14)
//
const LISTENED_KINDS = [4, 13, 14, 1059];

// How many seconds back to fetch on first connection
const SINCE_SECONDS = 24 * 60 * 60; // 24 h

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

  /** AppState subscription reference */
  private appStateSub: any = null;

  /** Reconnect timer */
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  public start(privkeyHex: string, pubkeyHex: string): void {
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
      try { this.pool.close(RELAYS); } catch { /* ignore */ }
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
      try { this.pool.close(RELAYS); } catch { /* ignore */ }
      this.pool = null;
    }
    this.processedEvents.clear();
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
        this._processEvent(event).catch(() => { /* silent */ });
      },
      oneose: () => {
        console.log('[NostrService] ✅ Initial EOSE — relay sync complete, listening for new events…');
      },
    });

    console.log(`[NostrService] Subscribed to kinds [${LISTENED_KINDS.join(', ')}] across ${RELAYS.length} relays`);
  }

  private _startReconnectLoop(): void {
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);

    this.reconnectTimer = setInterval(() => {
      if (!this.isRunning || !this.privkeyHex || !this.pubkeyHex) return;

      // Check if any relay is disconnected
      const statuses = this.pool?.listConnectionStatus?.();
      if (!statuses) return;

      const anyDisconnected = Array.from(statuses.values()).some(v => v === false);
      if (anyDisconnected) {
        console.log('[NostrService] 🔄 Detected disconnected relay(s), refreshing subscription…');
        if (this.pool) {
          try { this.pool.close(RELAYS); } catch { /* ignore */ }
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
          try { this.pool.close(RELAYS); } catch { /* ignore */ }
          this.pool = null;
        }
        this._subscribe();
      }
    });
  }

  // ── Event Processing ───────────────────────────────────────────────────────

  private async _processEvent(event: Event): Promise<void> {
    if (this.processedEvents.has(event.id)) return;
    this.processedEvents.add(event.id);

    if (!this.privkeyHex || !this.pubkeyHex || !this.privkeyBytes) return;

    // Skip our own outgoing events UNLESS it's a self-send (sender = recipient).
    // When you send to yourself, the event's author is you AND the #p tag is also you.
    if (event.pubkey === this.pubkeyHex) {
      const pTags = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
      const isSelfSend = pTags.includes(this.pubkeyHex!);
      if (!isSelfSend) {
        return; // Outgoing event to someone else — skip
      }
      // Self-send — continue processing as incoming payment
      console.log(`[NostrService] Self-send detected (event ${event.id.slice(0, 8)}…), processing as incoming`);
    }

    console.log(
      `[NostrService] Event ${event.id.slice(0, 8)}… kind=${event.kind} from ${event.pubkey.slice(0, 8)}…`,
    );

    try {
      const decrypted = await this._decrypt(event);
      if (decrypted === null) return;

      await this._handleDecrypted(decrypted, event);
    } catch (err) {
      // Decryption failure is normal if the key is wrong — do not log as error
      // console.debug(`[NostrService] Could not process event ${event.id}:`, err);
    }
  }

  /**
   * Attempt to decrypt an event. Returns the plaintext string, or null if unhandled/failed.
   */
  private async _decrypt(event: Event): Promise<string | null> {
    if (!this.privkeyHex || !this.privkeyBytes) return null;

    // ── Kind 4: NIP-04 legacy encrypted DM ──────────────────────────────
    if (event.kind === 4) {
      try {
        return await nip04.decrypt(this.privkeyHex, event.pubkey, event.content);
      } catch {
        return null;
      }
    }

    // ── Kind 1059: NIP-59 Gift-Wrap (outer) ──────────────────────────────
    // Unwrap using NIP-59 to get the inner sealed event (Kind 13 or 14)
    if (event.kind === 1059) {
      try {
        const inner = unwrapEvent(event, this.privkeyBytes);
        // The inner event content is the actual message (NIP-17 style)
        if (inner.kind === 14 || inner.kind === 13) {
          return inner.content;
        }
        // Fallback: try NIP-44 decrypt on the inner event content
        const convKey = nip44.v2.utils.getConversationKey(this.privkeyBytes, Buffer.from(inner.pubkey, 'hex'));
        return nip44.v2.decrypt(inner.content, convKey);
      } catch {
        return null;
      }
    }

    // ── Kind 14: NIP-17 Private DM (direct, no outer gift-wrap) ─────────
    if (event.kind === 14 || event.kind === 13) {
      try {
        const senderPubBytes = Buffer.from(event.pubkey, 'hex');
        const convKey = nip44.v2.utils.getConversationKey(this.privkeyBytes, senderPubBytes);
        return nip44.v2.decrypt(event.content, convKey);
      } catch {
        // Also try NIP-04 as fallback
        try {
          return await nip04.decrypt(this.privkeyHex, event.pubkey, event.content);
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
  private async _handleDecrypted(text: string, sourceEvent: Event): Promise<void> {
    // ── 1. Check for incoming Payment Request (creqA / creqB) ──
    const creqMatch = text.match(/(creq[AB][A-Za-z0-9_=-]+)/i);
    if (creqMatch) {
      const creqString = creqMatch[1];
      console.log(`[NostrService] 🎉 Found incoming payment request in event ${sourceEvent.id.slice(0, 8)}…`);
      try {
        const { PaymentRequest } = await import('@cashu/cashu-ts');
        const pr = PaymentRequest.fromEncodedRequest(creqString);
        if (pr.amount && pr.mints && pr.mints.length > 0) {
          const { useNostrInboxStore } = await import('../../store/nostrInboxStore');
          const senderUsername = await this.getSenderUsername(sourceEvent.pubkey);

          useNostrInboxStore.getState().addIncoming({
            id: sourceEvent.id,
            type: 'request',
            tokenString: creqString,
            amount: pr.amount,
            mintUrl: pr.mints[0],
            senderPubkey: sourceEvent.pubkey,
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

    // First try to parse as JSON PaymentRequestPayload (used by cashu.me for request fulfillment)
    try {
      const payload = JSON.parse(text);
      if (payload && payload.proofs && payload.mint) {
        console.log(`[NostrService] 🎉 Found JSON PaymentRequestPayload in event ${sourceEvent.id.slice(0, 8)}…`);
        
        // Convert to standard V3/V4 token structure so our existing receive logic works
        const tokenStruct = {
          token: [{ mint: payload.mint, proofs: payload.proofs }]
        };
        
        const b64 = Buffer.from(JSON.stringify(tokenStruct)).toString('base64');
        tokenString = `cashuA${b64}`;
        
        mintUrl = payload.mint;
        amount = payload.proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
        requestIdFromPayload = payload.id;
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
      console.log(`[NostrService] 🎉 Found ecash token string in event ${sourceEvent.id.slice(0, 8)}…`);

      const cleaned = cleanToken(tokenString);
      const rawStr = cleaned.startsWith('cashu') ? cleaned.substring(5) : cleaned;

      if (rawStr.startsWith('B')) {
        // ── V4 CBOR token: manual byte scanning (no keyset lookup needed) ──
        try {
          const b64 = rawStr.substring(1); // strip version byte 'B'
          const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
          const pad = (4 - b64std.length % 4) % 4;
          const b64padded = b64std + '=='.substring(0, pad);
          const bytes = new Uint8Array(Buffer.from(b64padded, 'base64'));

          // Extract mint URL: find CBOR key "m" (0x61 0x6d)
          for (let i = 0; i < bytes.length - 2; i++) {
            if (bytes[i] === 0x61 && bytes[i + 1] === 0x6d) { // "m" key
              const lenByte = bytes[i + 2];
              const major = (lenByte >> 5) & 0x07;
              const info = lenByte & 0x1f;
              if (major === 3) { // text string
                let urlLen = 0;
                let urlStart = 0;
                if (info < 24) { urlLen = info; urlStart = i + 3; }
                else if (info === 24 && i + 4 < bytes.length) { urlLen = bytes[i + 3]; urlStart = i + 4; }
                else if (info === 25 && i + 5 < bytes.length) { urlLen = (bytes[i + 3] << 8) | bytes[i + 4]; urlStart = i + 5; }
                if (urlLen > 0 && urlStart + urlLen <= bytes.length) {
                  const url = new TextDecoder().decode(bytes.slice(urlStart, urlStart + urlLen));
                  if (url.startsWith('http')) mintUrl = url;
                }
              }
              break;
            }
          }

          // Extract total amount: find CBOR key "a" (0x61 0x61) — each proof has an 'a' field
          // Sum all small unsigned ints that follow 'a' keys
          let totalAmount = 0;
          for (let i = 0; i < bytes.length - 2; i++) {
            if (bytes[i] === 0x61 && bytes[i + 1] === 0x61) { // "a" key
              const valByte = bytes[i + 2];
              const valMajor = (valByte >> 5) & 0x07;
              const valInfo = valByte & 0x1f;
              if (valMajor === 0) { // unsigned int
                if (valInfo < 24) {
                  totalAmount += valInfo;
                } else if (valInfo === 24 && i + 3 < bytes.length) {
                  totalAmount += bytes[i + 3];
                } else if (valInfo === 25 && i + 4 < bytes.length) {
                  totalAmount += (bytes[i + 3] << 8) | bytes[i + 4];
                } else if (valInfo === 26 && i + 6 < bytes.length) {
                  totalAmount += (bytes[i + 3] << 24) | (bytes[i + 4] << 16) | (bytes[i + 5] << 8) | bytes[i + 6];
                }
              }
            }
          }
          amount = totalAmount;

          if (!mintUrl) {
            console.error('[NostrService] V4 token: could not extract mint URL');
            return;
          }
          console.log(`[NostrService] V4 CBOR parsed: mint=${mintUrl}, amount=${amount}`);
        } catch (err: any) {
          console.error('[NostrService] V4 CBOR parse error:', err?.message);
          return;
        }
      } else {
        // ── V3 JSON token: getDecodedToken is safe for V3 ──
        try {
          const decoded = getDecodedToken(cleaned);

          if ((decoded as any).token && (decoded as any).token.length > 0) {
            const first = (decoded as any).token[0];
            mintUrl = first.mint;
            amount = first.proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
          } else if ((decoded as any).mint && (decoded as any).proofs) {
            mintUrl = (decoded as any).mint;
            amount = (decoded as any).proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
          }
        } catch (err: any) {
          console.error('[NostrService] V3 token decode failed:', err?.message);
          return;
        }
      }
    }

    console.log(`[NostrService] Token: ${amount} sats from mint ${mintUrl}`);

    // Resolve sender username from local contacts or directory
    const senderUsername = await this.getSenderUsername(sourceEvent.pubkey);

    // ── Queue for manual claim via NostrClaimSheet ──────────────────────
    // Emit 'nostr:incoming' so the UI can present a claim sheet where the
    // user inspects the mint, amount, fees, and sender before accepting.
    DeviceEventEmitter.emit('nostr:incoming', {
      eventId: sourceEvent.id,
      tokenString,
      amount,
      mintUrl,
      senderPubkey: sourceEvent.pubkey,
      senderUsername,
      requestId: requestIdFromPayload,
    });
    console.log(`[NostrService] 🔔 Queued incoming payment for manual claim: ${amount} sats from ${sourceEvent.pubkey.slice(0, 8)}…`);
  }

  /**
   * Get the sender's username, first checking local contacts, then directory.
   */
  private async getSenderUsername(pubkeyHex: string): Promise<string | undefined> {
    try {
      const { useContactsStore } = await import('../../store/contactsStore');
      const { nip19 } = await import('nostr-tools');
      const npub = nip19.npubEncode(pubkeyHex);
      const store = useContactsStore.getState();
      const contact = store.contacts[npub] || store.favorites[npub];
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
   * Send a cashu token to a recipient via Nostr DM (NIP-04 Kind 4).
   *
   * This is used to fulfil a NUT-18 payment request that uses Nostr transport.
   * The token is encrypted to the recipient's pubkey and published across all
   * 12 relays so wallets like cashu.me and minibits can pick it up.
   *
   * @param tokenString   Encoded cashu token (cashuA... or cashuB...)
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

    // Encrypt with NIP-04 (standard for ecash DMs — compatible with cashu.me / minibits)
    const encryptedContent = await nip04.encrypt(
      senderPrivkeyHex,
      recipientPubkeyHex,
      tokenString,
    );

    const eventTemplate = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkeyHex]],
      content: encryptedContent,
    };

    const signedEvent = finalizeEvent(eventTemplate, senderPrivkeyBytes);

    const pool = this.pool ?? new SimplePool();

    console.log(
      `[NostrService] 📤 Sending token via Nostr DM to ${recipientPubkeyHex.slice(0, 8)}… on ${RELAYS.length} relays`,
    );

    try {
      await Promise.any(pool.publish(RELAYS, signedEvent));
      console.log(`[NostrService] ✅ Token published via Nostr. Event: ${signedEvent.id}`);

      // Emit event for UI
      DeviceEventEmitter.emit('nostr:sent', {
        eventId: signedEvent.id,
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
    pubkeyHex: string
  ): Promise<boolean> {
    const privkeyBytes = hexToBytes(privkeyHex);
    
    // Create ["mint", "<url>"] tags for each mint
    const tags = mints.map(url => ['mint', url]);

    const eventTemplate = {
      kind: 10019,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: '', // Public informational event, content is usually empty
    };

    const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);
    const pool = this.pool ?? new SimplePool();

    console.log(`[NostrService] 📤 Backing up ${mints.length} mints to Nostr (Kind 10019) on ${RELAYS.length} relays…`);

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
        .filter(tag => tag[0] === 'mint' && typeof tag[1] === 'string')
        .map(tag => tag[1]);

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
    pubkeyHex: string
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

      console.log(`[NostrService] 📤 Backing up encrypted NIP-60 wallet state (Kind 37375) to Nostr relays…`);
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
    pubkeyHex: string
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

