/**
 * Quotes service — mint quotes (deposit LN → ecash) and melt quotes (ecash → LN).
 *
 * Uses Manager.quotes (QuotesApi).
 * Melt uses two-step flow: prepareMeltBolt11 → executeMelt with rollback support.
 */

import { initService } from './initService';
import { purgeCorruptedKeysets } from './initService';
import type { MintQuoteResponse, MeltQuoteResponse } from '@cashu/cashu-ts';

function mgr() {
    return initService.getManager();
}

async function withKeysetRecovery<T>(mintUrl: string, fn: () => Promise<T>, retryCount: number = 0): Promise<T> {
    try {
        return await fn();
    } catch (err: any) {
        const msg: string = err?.message ?? '';
        if (msg.includes('Keyset verification failed') || msg.includes('buildKeychain')) {
            if (retryCount >= 1) {
                console.error(`[QuotesService] ❌ Keyset recovery failed after retry for ${mintUrl}`);
                throw err;
            }

            const idMatch = msg.match(/for ID ([A-Fa-f0-9]+)/);
            const keysetId = idMatch?.[1];
            console.warn(`[QuotesService] ⚠️ Keyset verification failed for ${mintUrl}. Purging and re-initializing…`);
            
            // Purge corrupted keyset from DB
            await purgeCorruptedKeysets(mintUrl, keysetId);
            
            // Re-initialize the Manager to clear in-memory cache and force re-fetch
            await initService.reinitFast();
            
            // Retry the operation
            return await withKeysetRecovery(mintUrl, fn, retryCount + 1);
        }
        throw err;
    }
}


export const quotesService = {
    // ─── Minting (Lightning → Ecash) ─────────────────────────

    /**
     * Create a mint quote — returns a Lightning invoice to pay.
     *
     * @param mintUrl - The mint to create quote from
     * @param amount - Amount in sats to mint
     * @returns MintQuoteResponse with `quote` (id) and Lightning `request` (invoice)
     */
    createMintQuote: async (mintUrl: string, amount: number): Promise<MintQuoteResponse> => {
        console.log(`[QuotesService] Creating mint quote: ${amount} sats from ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            const quote = await mgr().quotes.createMintQuote(mintUrl, amount);
            console.log(`[QuotesService] ✅ Mint quote created: ${quote.quote}`);
            return quote;
        });
    },


    /**
     * Manually redeem a paid mint quote to get ecash.
     * Note: With watchers/processors enabled, this happens automatically.
     */
    redeemMintQuote: async (mintUrl: string, quoteId: string): Promise<void> => {
        console.log(`[QuotesService] Redeeming mint quote: ${quoteId}`);
        await mgr().quotes.redeemMintQuote(mintUrl, quoteId);
        console.log('[QuotesService] Mint quote redeemed');
    },

    /**
     * Add existing mint quotes (e.g. imported from another wallet).
     */
    addMintQuotes: async (
        mintUrl: string,
        quotes: MintQuoteResponse[]
    ): Promise<{ added: string[]; skipped: string[] }> => {
        return mgr().quotes.addMintQuote(mintUrl, quotes);
    },

    /**
     * Requeue all PAID (but not yet ISSUED) quotes for processing.
     */
    requeuePaidQuotes: async (mintUrl?: string): Promise<{ requeued: string[] }> => {
        return mgr().quotes.requeuePaidMintQuotes(mintUrl);
    },

    // ─── Melting (Ecash → Lightning) ──────────────────────────

    /**
     * Create a melt quote — estimates cost to pay a Lightning invoice.
     * For backward compat, uses direct createMeltQuote.
     *
     * @param mintUrl - The mint to melt from
     * @param invoice - Lightning invoice (bolt11) to pay
     * @returns MeltQuoteResponse with amount, fee_reserve, and quote id
     */
    createMeltQuote: async (mintUrl: string, invoice: string): Promise<MeltQuoteResponse> => {
        console.log(`[QuotesService] Creating melt quote from ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            const quote = await mgr().quotes.createMeltQuote(mintUrl, invoice);
            console.log(`[QuotesService] ✅ Melt quote created: ${quote.quote}`);
            return quote;
        });
    },


    /**
     * Prepare a melt operation (two-step flow — step 1).
     * Reserves proofs and returns an operation that can be executed or rolled back.
     *
     * @param mintUrl - The mint to melt from
     * @param invoice - Lightning invoice to pay
     * @returns Operation with id, quoteId, amount, fee_reserve
     */
    prepareMelt: async (mintUrl: string, invoice: string) => {
        console.log(`[QuotesService] Preparing melt from ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            const operation = await mgr().quotes.prepareMeltBolt11(mintUrl, invoice);
            console.log(`[QuotesService] ✅ Melt prepared: ${operation.id}`);
            return operation;
        });
    },


    /**
     * Execute a prepared melt operation (two-step flow — step 2).
     *
     * @param operationId - The operation ID from prepareMelt
     */
    executeMelt: async (operationId: string): Promise<void> => {
        console.log(`[QuotesService] Executing melt: ${operationId}`);
        await mgr().quotes.executeMelt(operationId);
        console.log(`[QuotesService] ✅ Melt executed: ${operationId}`);
    },

    /**
     * Pay a Lightning invoice using ecash (melt).
     * Legacy single-step method — wraps prepare + execute.
     *
     * @param mintUrl - The mint to melt from
     * @param quoteId - The quote ID to pay (legacy)
     */
    payMeltQuote: async (mintUrl: string, quoteId: string): Promise<void> => {
        console.log(`[QuotesService] Paying melt quote: ${quoteId}`);
        await mgr().quotes.payMeltQuote(mintUrl, quoteId);
        console.log('[QuotesService] Melt quote paid');
    },

    // ─── NUT-17 WebSocket Subscriptions (wss://) ───────────────

    /**
     * Subscribe to real-time mint quote status updates via NUT-17 WebSocket.
     * Replaces HTTP polling for instant payment detection and lower battery consumption.
     *
     * @param mintUrl - The mint URL
     * @param quoteId - The mint quote ID to monitor
     * @param onPaid - Callback triggered when invoice payment is confirmed
     * @returns Unsubscribe function to close WebSocket connection
     */
    subscribeMintQuoteWss: (mintUrl: string, quoteId: string, onPaid: () => void): (() => void) => {
        let ws: WebSocket | null = null;
        let isClosed = false;

        try {
            const wsUrl = mintUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/v1/ws';
            console.log(`[QuotesService] 📡 Connecting NUT-17 WebSocket for quote ${quoteId} to ${wsUrl}`);
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (isClosed) return;
                ws?.send(JSON.stringify({
                    kind: 'subscribe',
                    subId: `sub_mint_${quoteId.slice(0, 8)}`,
                    params: { kind: 'bolt11_mint_quote', filters: [quoteId] }
                }));
            };

            ws.onmessage = (event) => {
                if (isClosed) return;
                try {
                    const data = JSON.parse(event.data);
                    const payload = data.params ?? data;
                    if ((payload.quote === quoteId || payload.id === quoteId) && (payload.state === 'PAID' || payload.state === 'ISSUED')) {
                        console.log(`[QuotesService] ⚡ NUT-17 WSS: Mint Quote ${quoteId} is PAID!`);
                        onPaid();
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            };

            ws.onerror = (err) => {
                console.warn('[QuotesService] NUT-17 WSS error:', err);
            };
        } catch (e) {
            console.warn('[QuotesService] NUT-17 WSS connection failed:', e);
        }

        return () => {
            isClosed = true;
            if (ws) {
                try { ws.close(); } catch (e) {}
            }
        };
    },
};
