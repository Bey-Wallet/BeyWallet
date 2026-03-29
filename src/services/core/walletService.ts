/**
 * Wallet service — send, receive, balances, restore.
 *
 * Uses Manager APIs:
 * - manager.send (SendApi) — two-step: prepareSend → executePreparedSend + rollback
 * - manager.wallet (WalletApi) — receive, getBalances, restore
 *
 * The two-step send flow prevents stuck/reserved proofs by allowing
 * rollback if the operation fails after preparation.
 */

import { initService } from './initService';
import { purgeCorruptedKeysets } from './initService';
import { cleanToken, encodeToken } from './tokenUtils';
import type { Token } from '@cashu/cashu-ts';
import { getDecodedToken, getEncodedToken } from '@cashu/cashu-ts';
import type { CoreProof } from 'coco-cashu-core';


// Helper to generate a unique ID for operations since the crypto util import is broken
const generateSubId = (): string => {
    return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

/**
 * Get the Manager or throw.
 */
function mgr() {
    return initService.getManager();
}

/**
 * Wraps a wallet operation with automatic keyset-cache recovery.
 *
 * When coco-cashu-core throws "Keyset verification failed" (corrupted keyset
 * in the local SQLite cache), this helper:
 *   1. Extracts the keyset ID from the error message
 *   2. Calls purgeCorruptedKeysets() to delete the bad row from coco_cashu_keysets
 *   3. Retries the operation once with a fresh keyset fetch from the mint
 *
 * @param mintUrl - The mint involved in the operation (for targeted purge)
 * @param fn      - The async operation to execute (and retry on keyset failure)
 */
async function withKeysetRecovery<T>(mintUrl: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err: any) {
        const msg: string = err?.message ?? '';
        if (msg.includes('Keyset verification failed') || msg.includes('buildKeychain')) {
            // Extract keyset ID from message: "Keyset verification failed for ID <id>"
            const idMatch = msg.match(/for ID ([A-Fa-f0-9]+)/);
            const keysetId = idMatch?.[1];
            console.warn(
                `[WalletService] ⚠️ Keyset verification failed for ${mintUrl}. Purging cache and retrying…`,
                keysetId ?? '(all keysets)',
            );
            await purgeCorruptedKeysets(mintUrl, keysetId);
            // Retry once — SDK will now fetch fresh keys from the mint
            return await fn();
        }
        throw err;
    }
}


export const walletService = {
    // ─── Sending ──────────────────────────────────────────────

    /**
     * Send ecash from a specific mint using two-step flow.
     *
     * Step 1: prepareSend() — reserves proofs and prepares the operation
     * Step 2: executePreparedSend() — executes the swap and creates token
     *
     * On error after prepare, automatically rolls back to free reserved proofs.
     *
     * @param mintUrl - The mint to send from
     * @param amount - Amount to send in sats
     * @returns Encoded token string (V4) and operation ID
     */
    send: async (mintUrl: string, amount: number): Promise<{ token: string; id: string }> => {
        console.log(`[WalletService] Sending ${amount} from ${mintUrl}`);

        return withKeysetRecovery(mintUrl, async () => {
            const m = mgr();
            let preparedId: string | null = null;

            try {
                const prepared = await m.send.prepareSend(mintUrl, amount);
                preparedId = prepared.id;
                console.log(`[WalletService] Send prepared: ${preparedId}`);

                const { token, operation } = await m.send.executePreparedSend(prepared.id);
                const encoded = encodeToken(token);

                console.log(`[WalletService] Send complete, operation: ${operation.id}`);
                return { token: encoded, id: operation.id };
            } catch (err: any) {
                if (preparedId) {
                    try {
                        const operation = await m.send.getOperation(preparedId);
                        if (operation && ['prepared', 'executing', 'pending'].includes(operation.state)) {
                            await m.send.rollback(preparedId);
                            console.log(`[WalletService] Rolled back failed send: ${preparedId}`);
                        }
                    } catch (rollbackErr) {
                        console.warn('[WalletService] Rollback failed:', rollbackErr);
                    }
                }
                throw err;
            }
        });
    },


    /**
     * Send and return both encoded string and raw Token object.
     */
    sendWithToken: async (
        mintUrl: string,
        amount: number
    ): Promise<{ encoded: string; token: Token }> => {
        return withKeysetRecovery(mintUrl, async () => {
            const m = mgr();
            let preparedId: string | null = null;

            try {
                const prepared = await m.send.prepareSend(mintUrl, amount);
                preparedId = prepared.id;
                const { token } = await m.send.executePreparedSend(prepared.id);
                const encoded = encodeToken(token);
                return { encoded, token };
            } catch (err) {
                if (preparedId) {
                    try {
                        const op = await m.send.getOperation(preparedId);
                        if (op && ['prepared', 'executing', 'pending'].includes(op.state)) {
                            await m.send.rollback(preparedId);
                        }
                    } catch (e) { /* ignore rollback errors */ }
                }
                throw err;
            }
        });
    },


    // ─── P2PK Sending ─────────────────────────────────────────

    sendP2PK: async (
        mintUrl: string,
        amount: number,
        receiverPubkey: string
    ): Promise<{ encoded: string; token: Token; id: string }> => {
        const m = mgr();
        const unsafeManager = m as any;

        // 1. Ensure mint is trusted and get internal cashu-ts wallet + proof repository
        if (!(await unsafeManager.mintService.isTrustedMint(mintUrl))) {
            throw new Error(`Mint ${mintUrl} is not trusted`);
        }

        const { wallet } = await unsafeManager.walletService.getWalletWithActiveKeysetId(mintUrl);
        const availableProofs = await unsafeManager.proofRepository.getAvailableProofs(mintUrl);

        const totalAvailable = availableProofs.reduce((acc: number, p: CoreProof) => acc + p.amount, 0);
        if (totalAvailable < amount) {
            throw new Error(`Insufficient balance: need ${amount}, have ${totalAvailable}`);
        }

        // 2. Select proofs and perform the swap.
        // We use explicit `prepareSwapToSend` so that we can capture `txn.inputs` and mark those exact proofs as SPENT.
        console.log(`[WalletService] Executing send OP to lock to: ${receiverPubkey}`);
        let keepProofs: any[] = [];
        let sendProofs: any[] = [];
        let inputSecrets: string[] = [];

        try {
            const customConfig = {
                send: { type: 'p2pk', options: { pubkey: receiverPubkey } },
                keep: { type: 'random' }
            };

            let txn;
            try {
                // Attempt 1
                txn = await wallet.prepareSwapToSend(amount, availableProofs, { includeFees: true }, customConfig as any);
            } catch (firstErr: any) {
                if (firstErr?.message?.includes('already spent') || firstErr?.message?.includes('11001')) {
                    console.log(`[WalletService] Caught "already spent" state mismatch. Auto-healing local database...`);
                    // Force the database to drop spent proofs
                    await unsafeManager.proofService.checkState(mintUrl);
                    // Re-fetch clean proofs
                    const refreshedProofs = await unsafeManager.proofRepository.getAvailableProofs(mintUrl);
                    console.log(`[WalletService] Retrying send after healing database...`);
                    txn = await wallet.prepareSwapToSend(amount, refreshedProofs, { includeFees: true }, customConfig as any);
                    // Update availableProofs reference for the filter later
                    availableProofs.splice(0, availableProofs.length, ...refreshedProofs);
                } else {
                    throw firstErr;
                }
            }

            const swapResult = await wallet.completeSwap(txn);

            keepProofs = swapResult.keep;
            sendProofs = swapResult.send;
            inputSecrets = txn.inputs.map((p: any) => p.secret);
        } catch (opsErr: any) {
            console.error('[WalletService] ops.send failed:', opsErr?.message || opsErr);
            console.error('[WalletService] ops.send Full Error:', JSON.stringify(opsErr, Object.getOwnPropertyNames(opsErr)));
            throw opsErr;
        }

        // 3. Update Proof Repository Manually 
        // Emulate what coco's SendOperationService does:
        // Set inputs to SPENT, add keepProofs as READY, and theoretically sendProofs as INFLIGHT
        const operationId = generateSubId();

        // 4a. Mark keep proofs as ready (filter out unspent proofs we already had!)
        const availableSecrets = new Set(availableProofs.map((p: any) => p.secret));
        const newKeepProofs = keepProofs.filter((p: any) => !availableSecrets.has(p.secret));

        if (newKeepProofs.length > 0) {
            const keepCoreProofs = newKeepProofs.map((p: any) => ({
                ...p,
                mintUrl,
                state: 'ready',
                createdByOperationId: operationId
            }));
            await unsafeManager.proofService.saveProofs(mintUrl, keepCoreProofs);
        }

        // 4b. Mark sending proofs as inflight
        const sendCoreProofs = sendProofs.map((p: any) => ({
            ...p,
            mintUrl,
            state: 'inflight',
            createdByOperationId: operationId
        }));
        await unsafeManager.proofService.saveProofs(mintUrl, sendCoreProofs);

        // 4c. SPENT the inputs 
        await unsafeManager.proofService.setProofState(mintUrl, inputSecrets, 'spent');

        // 5. Build Token
        const token: Token = {
            mint: mintUrl,
            proofs: sendProofs,
            unit: wallet.unit || 'sat'
        };
        const encoded = encodeToken(token);
        console.log(`[WalletService] ✅ P2PK Send execution complete! Token locked to: ${receiverPubkey}`);

        // Ideally we also create an operation or history log, but coco's internals are slightly opaque
        // For now, this effectively subtracts balance and hands off a token.
        try {
            await initService.getRepo().historyRepository.addHistoryEntry({
                mintUrl,
                unit: wallet.unit || 'sat',
                createdAt: Date.now(),
                type: 'send',
                amount: amount,
                operationId: operationId,
                state: 'pending',
                token: token,
                metadata: {
                    p2pkPubkey: receiverPubkey,
                    type: 'p2pk'
                }
            });
            console.log(`[WalletService] History tracking injected for P2PK send.`);
        } catch (histErr) {
            console.warn('[WalletService] Failed to inject history entry:', histErr);
        }

        return { encoded, token, id: operationId };
    },

    // ─── Receiving ────────────────────────────────────────────

    /**
     * Receive an ecash token and add proofs to wallet.
     *
     * The Manager's WalletApi.receive() handles:
     * - Token decoding
     * - Mint trust verification
     * - Keyset fetching and alignment
     * - Proof swapping with correct unit
     * - Saving new proofs to repository
     * - Recording history entry
     * - Emitting 'receive:created' event
     *
     * @param token - Encoded cashu token string
     */
    receive: async (token: string): Promise<void> => {
        const cleaned = cleanToken(token);
        console.log('[WalletService] Receiving token:', cleaned.substring(0, 50) + '...');

        try {
            await mgr().wallet.receive(cleaned);
            console.log('[WalletService] Token received successfully');
        } catch (err: any) {
            console.error('[WalletService] Receive failed:', err?.message || err);
            console.error('[WalletService] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

            // If it's an "untrusted mint" error, provide helpful message
            if (err?.message?.includes('not trusted') || err?.name === 'UnknownMintError') {
                throw new Error('Mint is not trusted. Please add and trust the mint first.');
            }

            // If it's a proof validation error, provide helpful message
            if (err?.message?.includes('Invalid token') || err?.name === 'ProofValidationError') {
                throw new Error('Invalid token format. Please check the token and try again.');
            }

            // If proofs could not be verified
            if (err?.message?.includes('could not be verified') || err?.message?.includes('outputs')) {
                throw new Error('Token proofs could not be verified. The token may have already been redeemed.');
            }

            throw err;
        }
    },

    /**
     * Receive a P2PK locked ecash token.
     * 
     * @param token - Encoded cashu token string
     * @param nostrPrivKey - The private key used to unlock the proofs (hex array or single hex string)
     */
    receiveP2PK: async (token: string, nostrPrivKey: string | string[]): Promise<void> => {
        const cleaned = cleanToken(token);
        console.log('[WalletService] Receiving P2PK token:', cleaned.substring(0, 50) + '...');
        const unsafeManager = mgr() as any;

        try {
            // 1. Decode generic token
            const decoded = getDecodedToken(cleaned);
            let mintUrl = '';
            let receivedProofs: any[] = [];

            // @ts-ignore - Handle Both V3 / V4 token variations
            if (decoded.token && decoded.token.length > 0) {
                // @ts-ignore
                const firstMintEntry = decoded.token[0];
                mintUrl = firstMintEntry.mint;
                receivedProofs = firstMintEntry.proofs;
            } else if (decoded.mint && decoded.proofs && decoded.proofs.length > 0) {
                mintUrl = decoded.mint;
                receivedProofs = decoded.proofs;
            } else {
                throw new Error("Invalid or empty token");
            }

            // 3. Ensure mint is trusted / added
            if (!(await unsafeManager.mintService.isTrustedMint(mintUrl))) {
                throw new Error(`Mint ${mintUrl} is not trusted`);
            }

            // 4. Get active wallet
            const { wallet } = await unsafeManager.walletService.getWalletWithActiveKeysetId(mintUrl);

            // 5. Build cashu-ts receive op with the privkey
            const receivedAmount = receivedProofs.reduce((acc: number, p: any) => acc + p.amount, 0);

            console.log(`[WalletService] Received amount: ${receivedAmount}. Unlocking with P2PK and randomizing change...`);
            const newProofs = await wallet.ops
                .receive(cleaned)
                .privkey(nostrPrivKey)
                .asRandom() // Bypass deterministic counters to prevent 'outputs already signed' on retry
                .run();

            // 6. Save newly minted proofs to the DB
            const coreProofs = newProofs.map((p: any) => ({
                ...p,
                mintUrl,
                state: 'ready',
                createdByOperationId: 'p2pk_receive_' + Date.now() // placeholder for history tracking
            }));

            await unsafeManager.proofService.saveProofs(mintUrl, coreProofs);

            // 7. Fire event for UI updates
            unsafeManager.eventBus.emit('receive:created', {
                mintUrl,
                amount: receivedAmount,
                token: cleaned,
                timestamp: Date.now()
            });

            // 8. Record in history
            try {
                const tokenObj = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
                await initService.getRepo().historyRepository.addHistoryEntry({
                    mintUrl,
                    unit: wallet.unit || 'sat',
                    createdAt: Date.now(),
                    type: 'receive',
                    amount: receivedAmount,
                    state: 'success',
                    token: tokenObj,
                    metadata: {
                        type: 'p2pk'
                    }
                } as any);
                console.log(`[WalletService] History tracking injected for P2PK receive.`);
            } catch (histErr) {
                console.warn('[WalletService] Failed to inject history entry for receive:', histErr);
            }

            console.log('[WalletService] P2PK Token received and proofs saved successfully');
        } catch (err: any) {
            console.error('[WalletService] P2PK Receive failed:', err?.message || err);
            console.error('[WalletService] P2PK Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            throw err;
        }
    },

    // ─── Balance ──────────────────────────────────────────────

    /**
     * Get balances for all mints.
     * Returns { mintUrl: totalAmount } map.
     */
    getBalances: async (): Promise<Record<string, number>> => {
        return mgr().wallet.getBalances();
    },

    /**
     * Get balance for a specific mint across all units (summed).
     */
    getBalanceForMint: async (mintUrl: string): Promise<number> => {
        const balances = await mgr().wallet.getBalances();
        console.log('[WalletService] Raw balances:', JSON.stringify(balances));

        const normalize = (url: string) => url.replace(/\/$/, '');
        const normalizedTarget = normalize(mintUrl);

        for (const [url, bal] of Object.entries(balances)) {
            if (normalize(url) === normalizedTarget) {
                return bal;
            }
        }
        return 0;
    },

    // ─── Restore ──────────────────────────────────────────────

    /**
     * Restore all deterministic proofs for a mint from the BIP-39 seed.
     *
     * Uses the Coco SDK's built-in WalletApi.restore() — the same approach Sovran uses.
     *
     * Pre-condition fix: the SDK throws "Keyset has no keys loaded" for old inactive
     * keysets that are stored by ID only (no keypairs in the local DB). We fix this by:
     *  1. Fetching all keysets for the mint (including old/inactive ones)
     *  2. For any keyset missing keypairs, fetching keys from the mint network
     *  3. Storing the keys in the SDK's own keysetRepository so getKeyset() works
     *  4. Then calling the SDK restore which now has all keys it needs
     */
    restore: async (mintUrl: string): Promise<void> => {
        const start = Date.now();
        const m = mgr();
        const unsafeManager = m as any;
        console.log(`[WalletService] 🔄 Starting SDK restore for: ${mintUrl}`);

        try {
            // Step 1: Pre-warm all keyset keys so SDK's internal WalletRestoreService
            // doesn't throw "Keyset has no keys loaded" for old inactive keysets.
            //
            // Strategy: fetch keysets list from DB, then for any keyset with no keys,
            // hit the mint network and write the keys into the SDK's keysetRepository.
            try {
                const keysetRepo = unsafeManager.keysetRepository;
                if (keysetRepo?.getKeysets) {
                    const keysets: any[] = await keysetRepo.getKeysets([mintUrl]);
                    const { Mint: CashuMint } = await import('@cashu/cashu-ts');

                    for (const ks of keysets) {
                        const hasKeys = ks.keypairs && Object.keys(ks.keypairs).length > 0;
                        if (!hasKeys) {
                            console.log(`[WalletService] Fetching missing keys for keyset: ${ks.id}`);
                            try {
                                const mint = new CashuMint(mintUrl);
                                const keys = await mint.getKeys(ks.id);
                                // Write keys back into the keyset row
                                if (keysetRepo.updateKeysetKeys) {
                                    await keysetRepo.updateKeysetKeys(ks.id, keys);
                                } else if (keysetRepo.saveKeyset) {
                                    await keysetRepo.saveKeyset({ ...ks, keypairs: keys });
                                }
                                console.log(`[WalletService] ✅ Keys fetched for keyset: ${ks.id}`);
                            } catch (keyErr) {
                                console.warn(`[WalletService] Could not fetch keys for ${ks.id}:`, keyErr);
                            }
                        }
                    }
                }
            } catch (preWarmErr) {
                // Non-fatal — SDK will throw its own error if keys are missing
                console.warn(`[WalletService] Pre-warm step failed (SDK restore may still work):`, preWarmErr);
            }

            // Step 2: Use Coco SDK's native restore — same as Sovran uses.
            // manager.wallet.restore() handles keyset iteration, gap detection,
            // proof saving and counter updates internally.
            await m.wallet.restore(mintUrl);
            console.log(`[WalletService] ✅ SDK restore complete for: ${mintUrl}`);
        } catch (err: any) {
            // "Failed to restore some keysets" is a partial success — the SDK already
            // saved whatever proofs it found before hitting the problematic keyset.
            // Treat as a warning (not fatal) so the balance reflects restored proofs.
            if (err?.message?.includes('restore some keysets') || err?.message?.includes('Keyset has no keys')) {
                console.warn(`[WalletService] ⚠️ Partial restore for ${mintUrl} (some old keysets missing keys, saved proofs are intact):`, err?.message);
            } else {
                console.error(`[WalletService] SDK restore failed for ${mintUrl}:`, err?.message || err);
                throw err;
            }
        }

        // Rescue any proofs stuck in 'inflight' state from partial restore failures
        await walletService.restoreInflightProofs(mintUrl);

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[WalletService] ✅ Restore done for ${mintUrl} in ${duration}s`);
    },

    /**
     * Restore proofs that are stuck in an 'inflight' state back to 'ready'.
     * Needed when a core function throws an error midway and fails to clean up reserved proofs.
     */
    restoreInflightProofs: async (mintUrl: string): Promise<number> => {
        const m = mgr();
        const unsafeManager = m as unknown as {
            proofRepository?: {
                getInflightProofs: (urls?: string[]) => Promise<{ mintUrl: string; secret: string }[]>;
            };
            proofService?: {
                restoreProofsToReady: (mintUrl: string, secrets: string[]) => Promise<void>;
            };
        };

        const repo = unsafeManager.proofRepository;
        const svc = unsafeManager.proofService;
        if (!repo?.getInflightProofs || !svc?.restoreProofsToReady) return 0;

        try {
            const inflight = await repo.getInflightProofs([mintUrl]);
            if (inflight.length === 0) return 0;

            const secrets = inflight.map((p) => p.secret);
            await svc.restoreProofsToReady(mintUrl, secrets);
            console.log(`[WalletService] ✅ Restored ${secrets.length} stuck inflight proofs on ${mintUrl}`);
            return secrets.length;
        } catch (err) {
            console.warn('[WalletService] Failed to restore inflight proofs:', err);
            return 0;
        }
    },

    // ─── Send Operations ──────────────────────────────────────

    /**
     * Rollback a pending send operation. Used to free stuck proofs.
     */
    rollbackSend: async (operationId: string): Promise<void> => {
        console.log(`[WalletService] Rolling back send: ${operationId}`);
        await mgr().send.rollback(operationId);
        console.log(`[WalletService] ✅ Send rolled back: ${operationId}`);
    },

    /**
     * Get a send operation by ID.
     */
    getSendOperation: async (operationId: string) => {
        return mgr().send.getOperation(operationId);
    },

    /**
     * Finalize a send (mark as completed after recipient claims).
     */
    finalizeSend: async (operationId: string): Promise<void> => {
        await mgr().send.finalize(operationId);
    }
};
