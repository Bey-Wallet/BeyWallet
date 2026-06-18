import { initService } from './initService';
import { proofService } from './proofService';
import { walletService } from './walletService';
import { cleanToken, decodeToken, encodeToken } from './tokenUtils';

let sweepInterval: any = null;

export const expiryService = {
    /**
     * Checks all pending/unclaimed send history entries.
     * Sweeps (refunds) them if they are expired and unspent,
     * or updates their status to 'claimed' if they were spent.
     */
    checkAndSweepExpiredTokens: async (): Promise<void> => {
        try {
            if (!initService.isInitialized()) return;
            const repo = initService.getRepo();
            if (!repo?.historyRepository) return;

            const db = (repo.historyRepository as any).db;
            if (!db) return;

            // Fetch pending send history entries
            const rows = await db.all(
                `SELECT id, mintUrl, amount, tokenJson, metadata, operationId, state FROM coco_cashu_history
                 WHERE type = 'send' AND (state = 'pending' OR state = 'unclaimed')`
            );

            for (const row of rows) {
                try {
                    if (!row.metadata) continue;
                    const metadata = JSON.parse(row.metadata);
                    if (!metadata.expiresAt) continue;

                    // Check if expired
                    if (Date.now() > Number(metadata.expiresAt)) {
                        console.log(`[ExpiryService] Found expired pending token: id=${row.id}, opId=${row.operationId}`);
                        
                        // Parse token
                        let tokenStr: string | null = null;
                        if (row.tokenJson) {
                            try {
                                const tokenObj = JSON.parse(row.tokenJson);
                                tokenStr = encodeToken(tokenObj);
                            } catch (e) {
                                console.warn(`[ExpiryService] Failed to parse/encode token for row ${row.id}:`, e);
                            }
                        }

                        if (!tokenStr) continue;

                        // Check proof states with the mint
                        console.log(`[ExpiryService] Checking proof states at mint for expired token...`);
                        const states = await proofService.checkProofStates(tokenStr);
                        if (!states || states.length === 0) {
                            console.log(`[ExpiryService] Proof states check returned empty/failed. Skipping.`);
                            continue;
                        }

                        const allSpent = states.every((s: any) => s.state === 'SPENT');
                        if (allSpent) {
                            // Recipient has claimed it, update state to claimed
                            console.log(`[ExpiryService] Recipient has claimed the token. Marking as claimed.`);
                            await repo.historyRepository.updateHistoryEntryState(String(row.id), 'claimed');
                            
                            // Delete local inflight proofs if any
                            try {
                                const decoded = decodeToken(cleanToken(tokenStr));
                                const secrets = decoded.proofs.map((p: any) => p.secret);
                                if (secrets.length > 0) {
                                    await repo.proofRepository.deleteProofs(row.mintUrl, secrets);
                                }
                            } catch (e) {}
                        } else {
                            // Unspent, sweep/refund it!
                            console.log(`[ExpiryService] Token is unspent. Refunding/Sweeping token back to wallet...`);
                            try {
                                await walletService.receive(tokenStr);
                                console.log(`[ExpiryService] ✅ Successfully refunded token to wallet.`);
                                
                                // Mark history entry as expired (refunded)
                                await repo.historyRepository.updateHistoryEntryState(String(row.id), 'expired');

                                // Delete local inflight proofs if any
                                try {
                                    const decoded = decodeToken(cleanToken(tokenStr));
                                    const secrets = decoded.proofs.map((p: any) => p.secret);
                                    if (secrets.length > 0) {
                                        await repo.proofRepository.deleteProofs(row.mintUrl, secrets);
                                    }
                                } catch (e) {}
                            } catch (sweepErr: any) {
                                console.error(`[ExpiryService] Sweep failed for row ${row.id}:`, sweepErr?.message || sweepErr);
                            }
                        }
                    }
                } catch (rowErr) {
                    console.error(`[ExpiryService] Error processing row ${row.id}:`, rowErr);
                }
            }
        } catch (err) {
            console.error('[ExpiryService] Background sweep error:', err);
        }
    },

    /**
     * Retrieve the expiry info for a token based on its proof secrets.
     * Checks our local history repository to see if we have recorded this transaction.
     */
    getExpiryBySecrets: async (secrets: string[]): Promise<{ expiresAt: number; expiryHours: number } | null> => {
        try {
            if (!initService.isInitialized() || secrets.length === 0) return null;
            const repo = initService.getRepo();
            const db = (repo.historyRepository as any).db;
            if (!db) return null;

            // Fetch pending/unclaimed send history entries to look for matching secrets
            const rows = await db.all(
                `SELECT metadata, tokenJson FROM coco_cashu_history WHERE type = 'send' AND (state = 'pending' OR state = 'unclaimed')`
            );

            for (const row of rows) {
                if (!row.tokenJson) continue;
                try {
                    const tokenObj = JSON.parse(row.tokenJson);
                    const tokenProofs = tokenObj.proofs || [];
                    const hasMatch = tokenProofs.some((p: any) => secrets.includes(p.secret));
                    if (hasMatch && row.metadata) {
                        const meta = JSON.parse(row.metadata);
                        if (meta.expiresAt) {
                            return {
                                expiresAt: Number(meta.expiresAt),
                                expiryHours: Number(meta.expiryHours || 0)
                            };
                        }
                    }
                } catch {}
            }
        } catch (e) {
            console.warn('[ExpiryService] getExpiryBySecrets failed:', e);
        }
        return null;
    },

    /**
     * Start the periodic background sweeper.
     */
    startSweeper: (intervalMs = 60000): void => {
        if (sweepInterval) clearInterval(sweepInterval);
        
        // Run once on start
        expiryService.checkAndSweepExpiredTokens();
        
        sweepInterval = setInterval(() => {
            expiryService.checkAndSweepExpiredTokens();
        }, intervalMs);
        console.log(`[ExpiryService] Expiry sweeper started with interval ${intervalMs}ms`);
    },
    
    /**
     * Stop the periodic background sweeper.
     */
    stopSweeper: (): void => {
        if (sweepInterval) {
            clearInterval(sweepInterval);
            sweepInterval = null;
            console.log('[ExpiryService] Expiry sweeper stopped');
        }
    }
};
