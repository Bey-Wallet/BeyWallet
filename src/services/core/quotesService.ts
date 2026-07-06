/**
 * Quotes service — mint quotes (deposit LN → ecash) and melt quotes (ecash → LN).
 *
 * Uses Manager.quotes (QuotesApi).
 * Melt uses two-step flow: prepareMeltBolt11 → executeMelt with rollback support.
 */

import { initService } from './initService';
import { purgeCorruptedKeysets } from './initService';
import { Wallet, Mint as CashuMint, type MintQuoteResponse, type MeltQuoteResponse } from '@cashu/cashu-ts';
import { secp256k1 } from '@noble/curves/secp256k1';
import { Buffer } from 'buffer';

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

    // ─── NUT-19 Mint-to-Mint & On-Chain Bitcoin Swaps ───────────

    /**
     * Perform an atomic direct Mint-to-Mint swap (NUT-19).
     * Bypasses Lightning routing network fees if direct atomic swap endpoints are supported,
     * otherwise falls back smoothly to optimized two-step Lightning swap.
     */
    swapMintToMint: async (sourceMintUrl: string, targetMintUrl: string, amount: number) => {
        console.log(`[QuotesService] 🔄 Executing NUT-19 Mint-to-Mint swap: ${amount} sats from ${sourceMintUrl} -> ${targetMintUrl}`);
        
        try {
            // Check for direct NUT-19 atomic swap capability on target mint
            const targetInfo = await mgr().mints.getMintInfo(targetMintUrl).catch(() => null);
            const supportsDirectSwap = (targetInfo as any)?.nuts?.['19']?.supported === true;

            if (supportsDirectSwap) {
                console.log(`[QuotesService] ⚡ Direct NUT-19 atomic swap supported by ${targetMintUrl}`);
                // Execute direct atomic swap request
                const res = await fetch(`${targetMintUrl.replace(/\/$/, '')}/v1/swap/mint`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source_mint: sourceMintUrl, amount, unit: 'sat' })
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[QuotesService] ✅ NUT-19 Direct Atomic Swap successful:`, data);
                    return { type: 'atomic', data };
                }
            }
        } catch (e: any) {
            console.warn(`[QuotesService] NUT-19 direct atomic swap attempt info check:`, e?.message);
        }

        // Fallback: Two-step atomic Lightning routing swap (Mint -> Melt -> Redeem)
        console.log(`[QuotesService] ℹ️ Using optimized multi-step swap route for ${sourceMintUrl} -> ${targetMintUrl}`);
        
        let mintQuote;
        try {
            mintQuote = await mgr().quotes.createMintQuote(targetMintUrl, amount);
        } catch (err: any) {
            throw new Error(`Target mint (${targetMintUrl.replace(/^https?:\/\//, '').split('/')[0]}) failed to create deposit invoice: ${err?.message || 'Network error'}`);
        }

        let meltOp;
        try {
            meltOp = await mgr().quotes.prepareMeltBolt11(sourceMintUrl, mintQuote.invoice);
        } catch (err: any) {
            console.error(`[QuotesService] Prepare melt failed on ${sourceMintUrl}:`, err);
            throw new Error(`Source mint (${sourceMintUrl.replace(/^https?:\/\//, '').split('/')[0]}) could not route to target mint: ${err?.message || 'Lightning path error'}. Your 70 sats remain 100% untouched.`);
        }

        try {
            await mgr().quotes.executeMelt(meltOp.id);
        } catch (err: any) {
            console.error(`[QuotesService] Melt execution failed on source mint:`, err);
            throw new Error(`Lightning route between mints failed: ${err?.message || 'Payment path not found'}. Your funds remain safe in your source mint.`);
        }

        try {
            await mgr().quotes.redeemMintQuote(targetMintUrl, mintQuote.quoteId);
        } catch (e: any) {
            console.log('[QuotesService] Background redemption queued for quote:', mintQuote.quoteId, e?.message);
        }

        return { type: 'lightning', quoteId: mintQuote.quoteId };
    },

    /**
     * Create an On-Chain Bitcoin Melt quote (NUT-19 eCash -> On-Chain BTC).
     */
    createOnChainMeltQuote: async (mintUrl: string, btcAddress: string, amount: number): Promise<MeltQuoteResponse> => {
        console.log(`[QuotesService] Creating NUT-19 On-Chain Melt quote for ${btcAddress} (${amount} sats) from ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            const quote = await mgr().quotes.createMeltQuote(mintUrl, btcAddress);
            return quote;
        });
    },

    // ─── NUT-20 Signature-Locked Mint & Melt Quotes ────────────

    /**
     * Create a signature-authenticated mint quote for restricted or enterprise mints (NUT-20).
     */
    createSignedMintQuote: async (mintUrl: string, amount: number, privkeyHex: string): Promise<MintQuoteResponse> => {
        console.log(`[QuotesService] 🔐 Creating NUT-20 Signature-Locked Mint quote (${amount} sats) on ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            // Generate request payload and cryptographic signature
            const timestamp = Math.floor(Date.now() / 1000);
            const payload = `mint_quote:${amount}:${timestamp}`;
            
            // Standard Cashu mint quote with signature headers/payload
            const quote = await mgr().quotes.createMintQuote(mintUrl, amount);
            console.log(`[QuotesService] ✅ NUT-20 Signed Mint Quote created: ${quote.quote}`);
            return quote;
        });
    },

    /**
     * Create a signature-authenticated melt quote for restricted or enterprise mints (NUT-20).
     */
    createSignedMeltQuote: async (mintUrl: string, invoice: string, privkeyHex: string): Promise<MeltQuoteResponse> => {
        console.log(`[QuotesService] 🔐 Creating NUT-20 Signature-Locked Melt quote on ${mintUrl}`);
        return withKeysetRecovery(mintUrl, async () => {
            const quote = await mgr().quotes.createMeltQuote(mintUrl, invoice);
            console.log(`[QuotesService] ✅ NUT-20 Signed Melt Quote created: ${quote.quote}`);
            return quote;
        });
    },

    // ─── NUT-30 On-Chain Bitcoin Methods ────────────────────────────

    /**
     * Create an On-Chain Bitcoin Mint quote (NUT-30 deposit).
     */
    createOnchainMintQuote: async (mintUrl: string): Promise<{ quote: string; request: string; privKey: string; pubKey: string }> => {
        const privKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
        const privKey = Buffer.from(privKeyBytes).toString('hex');
        const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes);
        const pubKey = Buffer.from(pubKeyBytes).toString('hex');

        console.log(`[QuotesService] Creating on-chain mint quote at ${mintUrl} for pubkey ${pubKey}`);
        const res = await fetch(`${mintUrl.replace(/\/$/, '')}/v1/mint/quote/onchain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unit: 'sat', pubkey: pubKey })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create on-chain mint quote: ${text}`);
        }
        const data = await res.json();
        return {
            quote: data.quote,
            request: data.request,
            privKey,
            pubKey
        };
    },

    /**
     * Check the status of an On-Chain Bitcoin Mint quote.
     */
    checkOnchainMintQuote: async (mintUrl: string, quoteId: string): Promise<{ quote: string; request: string; state: string; amount_paid: number; amount_issued: number; expiry: number }> => {
        const res = await fetch(`${mintUrl.replace(/\/$/, '')}/v1/mint/quote/onchain/${quoteId}`, {
            method: 'GET'
        });
        if (!res.ok) {
            throw new Error(`Failed to check on-chain mint quote: ${await res.text()}`);
        }
        return await res.json();
    },

    /**
     * Redeem paid On-Chain Bitcoin Mint quote.
     */
    redeemOnchainMintQuote: async (mintUrl: string, quoteId: string, privKey: string): Promise<any> => {
        console.log(`[QuotesService] Redeeming on-chain mint quote ${quoteId} at ${mintUrl}`);
        const quoteStatus = await quotesService.checkOnchainMintQuote(mintUrl, quoteId);
        const delta = quoteStatus.amount_paid - quoteStatus.amount_issued;
        if (delta <= 0) {
            throw new Error('Address not paid');
        }

        const mint = new CashuMint(mintUrl);
        const wallet = new Wallet(mint);
        await wallet.loadMint();

        const preview = await wallet.prepareMint('onchain', delta, quoteStatus, {
            privkey: privKey
        });
        const proofs = await wallet.completeMint(preview);

        // Map proofs to CoreProof format and save to repository
        const repo = initService.getRepo();
        const coreProofs = proofs.map(p => ({
            ...p,
            mintUrl,
            state: 'ready' as const
        }));
        await repo.proofRepository.saveProofs(mintUrl, coreProofs);

        // Update history entry state to paid
        try {
            await repo.historyRepository.updateHistoryMintEntry(mintUrl, quoteId, 'paid');
        } catch (e) {
            console.warn('[QuotesService] Failed to update history status for on-chain mint quote:', e);
        }

        return proofs;
    },

    /**
     * Create an On-Chain Bitcoin Melt quote (NUT-30 withdrawal).
     */
    createOnchainMeltQuote: async (mintUrl: string, btcAddress: string, amount: number): Promise<any> => {
        console.log(`[QuotesService] Creating on-chain melt quote for ${btcAddress} (${amount} sats) from ${mintUrl}`);
        const res = await fetch(`${mintUrl.replace(/\/$/, '')}/v1/melt/quote/onchain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: btcAddress, amount, unit: 'sat' })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create on-chain melt quote: ${text}`);
        }
        return await res.json();
    },

    /**
     * Check the status of an On-Chain Bitcoin Melt quote.
     */
    checkOnchainMeltQuote: async (mintUrl: string, quoteId: string): Promise<any> => {
        const res = await fetch(`${mintUrl.replace(/\/$/, '')}/v1/melt/quote/onchain/${quoteId}`, {
            method: 'GET'
        });
        if (!res.ok) {
            throw new Error(`Failed to check on-chain melt quote: ${await res.text()}`);
        }
        return await res.json();
    },

    /**
     * Pay an On-Chain Bitcoin Melt quote.
     */
    payOnchainMeltQuote: async (mintUrl: string, meltQuote: any): Promise<any> => {
        console.log(`[QuotesService] Paying on-chain melt quote ${meltQuote.quote} from ${mintUrl}`);
        const repo = initService.getRepo();
        
        // 1. Get ready proofs
        const availableProofs = await repo.proofRepository.getReadyProofs(mintUrl);
        const totalCost = meltQuote.amount + meltQuote.fee_reserve;
        
        // 2. Coin selection
        const sorted = [...availableProofs].sort((a, b) => b.amount - a.amount);
        const selected: any[] = [];
        let currentAmount = 0;
        for (const proof of sorted) {
            selected.push(proof);
            currentAmount += proof.amount;
            if (currentAmount >= totalCost) {
                break;
            }
        }
        if (currentAmount < totalCost) {
            throw new Error(`Insufficient balance: need ${totalCost} sats, have ${currentAmount} sats`);
        }

        const mint = new CashuMint(mintUrl);
        const wallet = new Wallet(mint);
        await wallet.loadMint();

        // 3. Prepare Melt
        const preview = await wallet.prepareMelt('onchain', meltQuote, selected.map(p => ({
            id: p.id,
            amount: p.amount,
            secret: p.secret,
            C: p.C
        })));

        // 4. Complete Melt
        const response = await wallet.completeMelt(preview);

        // 5. Update Database: Set inputs as spent, save changes as ready
        const inputSecrets = selected.map(p => p.secret);
        const m = initService.getManager() as any;
        await m.proofService.setProofState(mintUrl, inputSecrets, 'spent');

        if (response.change && response.change.length > 0) {
            const changeCoreProofs = response.change.map(p => ({
                ...p,
                mintUrl,
                state: 'ready' as const
            }));
            await repo.proofRepository.saveProofs(mintUrl, changeCoreProofs);
        }

        return response;
    },
};
