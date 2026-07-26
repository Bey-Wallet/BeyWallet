/**
 * consolidationService — Proof Denomination Consolidation
 *
 * Over time wallets accumulate many small-denomination proofs (1, 2, 4, 8 sat).
 * Each send/receive payload grows with proof count, making operations slower.
 *
 * A "self-swap" sends the full balance back to yourself so the mint issues
 * fresh, optimally-denominated proofs (powers of two, minimal count).
 *
 * This is a purely local service that reuses walletService.send + receive.
 * It does NOT need its own network connection — it goes through the existing
 * Manager just like any normal send/receive.
 */

import { walletService } from './walletService';
import { proofService } from './proofService';
import { initService } from './initService';
import { decodeToken } from './tokenUtils';

export interface FragmentationAnalysis {
    /** 0–100. Higher = more fragmented. >60 is worth consolidating. */
    score: number;
    proofCount: number;
    totalAmount: number;
    /** Number of proofs with amount < 64 sats */
    smallProofCount: number;
    /** Estimated proof count after consolidation (optimal = log2 of totalAmount) */
    estimatedAfterCount: number;
}

export interface ConsolidationResult {
    mintUrl: string;
    before: { count: number; totalAmount: number };
    after: { count: number; totalAmount: number };
    /** Positive = proofs removed. Negative should never happen. */
    savedProofs: number;
}

export const consolidationService = {
    /**
     * Analyse denomination fragmentation for a given mint.
     * Safe to call at any time — read-only DB query.
     */
    getFragmentationAnalysis: async (mintUrl: string): Promise<FragmentationAnalysis> => {
        const proofs = await proofService.getReadyProofs(mintUrl);

        if (proofs.length === 0) {
            return { score: 0, proofCount: 0, totalAmount: 0, smallProofCount: 0, estimatedAfterCount: 0 };
        }

        const totalAmount = proofs.reduce((s, p) => s + p.amount, 0);
        const smallProofCount = proofs.filter(p => p.amount < 64).length;
        // Score: what percentage of proofs are tiny
        const score = Math.round((smallProofCount / proofs.length) * 100);
        // Optimal denomination set for totalAmount is roughly log2(totalAmount) proofs
        const estimatedAfterCount = totalAmount > 0 ? Math.ceil(Math.log2(totalAmount + 1)) : 0;

        return { score, proofCount: proofs.length, totalAmount, smallProofCount, estimatedAfterCount };
    },

    /**
     * Consolidate proofs for a single mint via a self-swap.
     *
     * Flow:
     *  1. Read all ready proofs → calculate total
     *  2. walletService.send(total)  → creates an encoded token using those proofs
     *  3. walletService.receive(token) → mint issues fresh optimal proofs
     *
     * The balance is unchanged. Only proof count changes.
     *
     * @throws if balance is 0 or already optimal (≤ 3 proofs)
     */
    consolidateMint: async (mintUrl: string): Promise<ConsolidationResult> => {
        const beforeProofs = await proofService.getReadyProofs(mintUrl);
        const totalAmount = beforeProofs.reduce((s, p) => s + p.amount, 0);

        if (totalAmount === 0) {
            throw new Error('No balance to consolidate at this mint.');
        }
        if (beforeProofs.length <= 3) {
            throw new Error('Wallet is already well-consolidated (≤ 3 proofs).');
        }

        console.log(`[Consolidation] Starting self-swap for ${mintUrl}: ${beforeProofs.length} proofs, ${totalAmount} sats`);

        // Step 1: Send — this locks the proofs into an inflight token
        const sendResult = await walletService.send(mintUrl, totalAmount);

        // Step 2: Receive — mint re-issues optimally-denominated proofs.
        // If receive fails for any reason (not just network errors), persist
        // the token as "unclaimed" history so the user can retry later.
        try {
            await walletService.receive(sendResult.token);
        } catch (receiveErr: any) {
            console.error(`[Consolidation] ❌ Receive failed after send succeeded:`, receiveErr?.message);
            try {
                const repo = initService.getRepo();
                if (repo?.historyRepository) {
                    const decoded = decodeToken(sendResult.token);
                    await repo.historyRepository.addHistoryEntry({
                        mintUrl,
                        type: 'send',
                        unit: 'sat',
                        amount: decoded.amount || totalAmount,
                        createdAt: Date.now(),
                        state: 'unclaimed',
                        token: decoded.raw || sendResult.token,
                        metadata: {
                            via: 'consolidation',
                            consolidationFailed: true,
                            originalReceiveError: receiveErr?.message,
                        },
                    });
                    console.log(`[Consolidation] Token saved as "unclaimed" in history. User can retry.`);
                }
            } catch (saveErr) {
                console.warn(`[Consolidation] Failed to save unclaimed token:`, saveErr);
            }
            throw new Error(
                `Consolidation failed — send succeeded but receive did not. ` +
                `Your funds are safe in the intermediate token. ` +
                `Go to your transaction history to claim the unlisted token. ` +
                `Error: ${receiveErr?.message || 'Unknown error'}`
            );
        }

        const afterProofs = await proofService.getReadyProofs(mintUrl);
        const afterAmount = afterProofs.reduce((s, p) => s + p.amount, 0);

        console.log(`[Consolidation] ✅ Done: ${beforeProofs.length} → ${afterProofs.length} proofs, ${totalAmount} → ${afterAmount} sats`);

        return {
            mintUrl,
            before: { count: beforeProofs.length, totalAmount },
            after: { count: afterProofs.length, totalAmount: afterAmount },
            savedProofs: beforeProofs.length - afterProofs.length,
        };
    },
};
