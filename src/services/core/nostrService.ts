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
const RELAYS: string[] = [
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

    this.pool.subscribeMany(RELAYS, [filter], {
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
   * Handle decrypted message content — look for cashu tokens and receive them.
   */
  private async _handleDecrypted(text: string, sourceEvent: Event): Promise<void> {
    // Match V3 (cashuA) and V4 (cashuB) tokens
    const tokenMatch = text.match(/(cashu[AB][A-Za-z0-9_=-]+)/i);
    if (!tokenMatch) {
      // Could be a payment request echo or other message — ignore silently
      return;
    }

    const tokenString = tokenMatch[1];
    console.log(`[NostrService] 🎉 Found ecash token in event ${sourceEvent.id.slice(0, 8)}…`);

    let amount = 0;
    let mintUrl = '';

    try {
      const decoded = getDecodedToken(cleanToken(tokenString));

      // Handle both V3 (decoded.token[]) and V4 (decoded.proofs + decoded.mint)
      if ((decoded as any).token && (decoded as any).token.length > 0) {
        const first = (decoded as any).token[0];
        mintUrl = first.mint;
        amount = first.proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
      } else if ((decoded as any).mint && (decoded as any).proofs) {
        mintUrl = (decoded as any).mint;
        amount = (decoded as any).proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
      }

      console.log(`[NostrService] Token: ${amount} sats from mint ${mintUrl}`);

      // ── Attempt P2PK receive first (locked to our key) ──────────────────
      let receiveError: any = null;
      // Lazy load walletService to prevent circular dependency at top-level
      const { walletService } = require('./walletService');

      try {
        await walletService.receiveP2PK(tokenString, this.privkeyHex!);
        console.log(`[NostrService] ✅ P2PK receive success: ${amount} sats`);
      } catch (p2pkErr: any) {
        receiveError = p2pkErr;

        // If proofs are not P2PK locked, try standard receive
        if (
          p2pkErr?.message?.includes('locked') === false &&
          p2pkErr?.message?.includes('P2PK') === false
        ) {
          try {
            await walletService.receive(tokenString);
            receiveError = null;
            console.log(`[NostrService] ✅ Standard receive success: ${amount} sats`);
          } catch (stdErr: any) {
            if (stdErr?.message?.includes('already spent')) {
              console.log('[NostrService] Token already spent — skipping');
              return;
            }
            throw stdErr;
          }
        } else if (p2pkErr?.message?.includes('already spent')) {
          console.log('[NostrService] P2PK token already spent — skipping');
          return;
        } else {
          throw p2pkErr;
        }
      }

      if (receiveError) throw receiveError;

      // ── Try to match+mark a pending nostr request as received ────────────
      try {
        const pending = nostrRequestStore.getPending();
        const match = pending.find(
          r =>
            r.mintUrl.replace(/\/$/, '') === mintUrl.replace(/\/$/, '') &&
            r.amount === amount &&
            r.state === 'pending',
        );
        if (match) {
          await nostrRequestStore.markReceived(match.id);
          console.log(`[NostrService] Linked payment to request ${match.id}`);
        }
      } catch (matchErr) {
        console.warn('[NostrService] Could not match request:', matchErr);
      }

      // ── Notify UI ────────────────────────────────────────────────────────
      DeviceEventEmitter.emit('nostr:received', {
        amount,
        mintUrl,
        eventId: sourceEvent.id,
      });
      console.log(`[NostrService] 🔔 Emitted nostr:received (${amount} sats)`);
    } catch (err: any) {
      console.error('[NostrService] Failed to receive token:', err?.message || err);;
    }
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
    // Resolve npub → hex
    let recipientPubkeyHex = recipientPubkeyHexOrNpub.trim();
    if (recipientPubkeyHex.startsWith('npub')) {
      try {
        const decoded = nip19Decode(recipientPubkeyHex);
        if (decoded.type === 'npub') {
          recipientPubkeyHex = decoded.data as string;
        } else {
          throw new Error('Not an npub');
        }
      } catch (e: any) {
        throw new Error(`Invalid npub: ${e.message}`);
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

