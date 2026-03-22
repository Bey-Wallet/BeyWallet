import { SimplePool, Filter, nip04, nip44, Event } from 'nostr-tools';
import { Buffer } from 'buffer';
import { walletService } from './walletService';
import { eventService } from './eventService';
import { DeviceEventEmitter } from 'react-native';
import { cleanToken } from './tokenUtils';
import { getDecodedToken } from '@cashu/cashu-ts';

/**
 * Service to run in the background and listen for incoming Cashu tokens via Nostr.
 * Supports NIP-04 and NIP-44 Direct Messages containing `cashuA` or `cashuB` tokens.
 */
class NostrService {
    private pool: SimplePool | null = null;
    private isRunning: boolean = false;
    private privkeyHex: string | null = null;
    private pubkeyHex: string | null = null;
    
    // Default relays to listen on (same as mintRecommendationService + damus)
    private readonly RELAYS = [
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://nos.lol",
        "wss://relay.8333.space/"
    ];

    // In-memory cache of processed event IDs to prevent duplicate processing
    private processedEvents: Set<string> = new Set();

    /**
     * Start the background Nostr listener.
     * @param privkeyHex - Hex-encoded Nostr private key
     * @param pubkeyHex - Hex-encoded Nostr public key
     */
    public start(privkeyHex: string, pubkeyHex: string) {
        if (this.isRunning) return;

        this.privkeyHex = privkeyHex;
        this.pubkeyHex = pubkeyHex;
        this.isRunning = true;
        this.pool = new SimplePool();

        console.log(`[NostrService] Starting Nostr listener for pubkey: ${pubkeyHex.slice(0, 8)}...`);

        // Listen for standard NIP-04 (Kind 4) and NIP-44 (Kind 1059)
        const filter: Filter = {
            kinds: [4, 1059],
            '#p': [pubkeyHex],
            since: Math.floor(Date.now() / 1000) - 86400, // Fetch anything from the last 24h
        };

        // Subscribe to events
        const sub = this.pool.subscribeMany(this.RELAYS, filter, {
            onevent: async (event: Event) => {
                console.log(`[NostrService] Received raw event: ${event.id} (kind ${event.kind}) from ${event.pubkey}`);
                await this.processEvent(event);
            },
            oneose: () => {
                console.log('[NostrService] Finished initial relay sync.');
            }
        });
    }

    /**
     * Stop the background listener.
     */
    public stop() {
        if (!this.isRunning || !this.pool) return;
        console.log('[NostrService] Stopping Nostr listener.');
        this.pool.close(this.RELAYS);
        this.pool = null;
        this.isRunning = false;
        this.privkeyHex = null;
        this.pubkeyHex = null;
        this.processedEvents.clear();
    }

    /**
     * Process an incoming Nostr event.
     */
    private async processEvent(event: Event) {
        // Prevent duplicate processing
        if (this.processedEvents.has(event.id)) {
            console.log(`[NostrService] Event ${event.id} already processed. Skipping.`);
            return;
        }
        this.processedEvents.add(event.id);

        if (!this.privkeyHex || !this.pubkeyHex) {
            console.error('[NostrService] Missing keys.');
            return;
        }

        try {
            let decryptedText = '';

            // 1. Decrypt based on kind
            if (event.kind === 4) {
                // NIP-04 encryption
                decryptedText = await nip04.decrypt(this.privkeyHex, event.pubkey, event.content);
            } else if (event.kind === 1059) {
                // NIP-44 (v2) Draft encryption
                const privBytes = new Uint8Array(Buffer.from(this.privkeyHex, 'hex'));
                const pubBytes = new Uint8Array(Buffer.from(event.pubkey, 'hex'));
                const conversationKey = nip44.v2.utils.getConversationKey(privBytes, pubBytes);
                decryptedText = nip44.v2.decrypt(event.content, conversationKey);
            } else {
                return;
            }

            // 2. Search for Cashu Tokens in the decrypted text
            // e.g. "Here is your money cashuAeyJ0b2tlbiI..."
            const cashuMatch = decryptedText.match(/(cashuA[A-Za-z0-9_-]+)/i);
            if (!cashuMatch) {
                console.log(`[NostrService] Event ${event.id} decrypted but no cashuA token found. Content preview: ${decryptedText.substring(0, 30)}...`);
                return;
            }

            const tokenString = cashuMatch[0];
            console.log(`[NostrService] Found ecash token in event ${event.id}. Processing...`);

            // 3. Receive the token into the wallet
            let amount = 0;
            try {
                // Decode token to find out how much it is for the notification
                const decoded = getDecodedToken(cleanToken(tokenString));
                // @ts-ignore - Handle Both V3 / V4 token variations
                if (decoded.token && decoded.token.length > 0) {
                    // @ts-ignore
                    amount = decoded.token[0].proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
                } else if (decoded.proofs) {
                    amount = decoded.proofs.reduce((acc: number, p: any) => acc + p.amount, 0);
                }

                // Actually claim the token via walletService (P2PK unlocked)
                await walletService.receiveP2PK(tokenString, this.privkeyHex);
                
                // 4. Fire success event so UI can display a toast/notification
                console.log(`[NostrService] Successfully received ₿${amount} sats!`);
                DeviceEventEmitter.emit('nostr:received', { amount, eventId: event.id });
                
                // Fire generic history update as well (UI triggers re-fetch)
                // We use initService.getManager().emit internally if we needed to, but query invalidation 
                // typically happens on the react-native layer.
                // receiveP2PK creates history implicitly.
            } catch (err: any) {
                if (err.message && err.message.includes('already spent')) {
                    console.log('[NostrService] Token was already spent. Ignoring.');
                } else {
                    console.error('[NostrService] Failed to receive NIP-04/44 token:', err);
                }
            }
        } catch (error) {
            // Decryption failure (normal if malicious or wrong keys)
            // console.warn(`[NostrService] Failed to decrypt event ${event.id}`);
        }
    }
}

export const nostrService = new NostrService();
