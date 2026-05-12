import { Wallet } from '@cashu/cashu-ts';
import { getEncodedToken } from '@cashu/cashu-ts';
import { cleanToken, decodeToken } from './tokenUtils';
import type { CoreProof } from 'coco-cashu-core';
import { initService } from './initService';



const decodeCache = new Map<string, any>();

export const proofService = {
    /**
     * Check the state of proofs from a token string.
     * Queries the mint to get current proof states (UNSPENT, SPENT, PENDING).
     *
     * @param tokenString - Encoded cashu token string
     * @returns Array of proof state objects from the mint
     */
    checkProofStates: async (tokenString: string) => {
        const cleaned = cleanToken(tokenString);
        let decoded: any;
        
        if (decodeCache.has(cleaned)) {
            decoded = decodeCache.get(cleaned);
        } else {
            try {
                decoded = decodeToken(cleaned);
                decodeCache.set(cleaned, decoded);
            } catch (e) {
                console.warn('[ProofService] Failed to decode token for check:', e);
                return [];
            }
        }

        if (!decoded || !decoded.proofs || decoded.proofs.length === 0) {
            return [];
        }

        try {
            console.log(`[ProofService] Checking state for ${decoded.mint} with ${decoded.proofs.length} proofs`);

            // We instantiate a new Wallet instance for the state check.
            // This is safer than relying on private services in the manager.
            const wallet = new Wallet(decoded.mint);


            // The library method handles the Y derivation internally from the secrets
            // It only needs the secret field, which we have in decoded.proofs
            console.log('[ProofService] Checking state via library...');
            const states = await wallet.checkProofsStates(decoded.proofs);

            console.log('[ProofService] States received:', states.length);

            // Map the states back to a consistent format if needed, 
            // though usually they match the NUT-07 response
            return states.map((s, i) => ({
                ...s,
                secret: decoded.proofs[i].secret // Attach secret for UI convenience
            }));
        } catch (err: any) {
            console.error(`[ProofService] Failed to check proof states at ${decoded.mint}:`, err);
            return [];
        }
    },

    /**
     * Get all ready (spendable) proofs for a specific mint from the local DB.
     */
    getReadyProofs: async (mintUrl: string): Promise<CoreProof[]> => {
        const repo = initService.getRepo();
        return repo.proofRepository.getReadyProofs(mintUrl);
    },

    /**
     * Get all ready proofs across all mints.
     */
    getAllReadyProofs: async (): Promise<CoreProof[]> => {
        const repo = initService.getRepo();
        return repo.proofRepository.getAllReadyProofs();
    },

    /**
     * Get all proofs in a specific state across all mints.
     * state: 'ready' | 'inflight' | 'spent'
     */
    getAllProofsByState: async (state: 'ready' | 'inflight' | 'spent'): Promise<CoreProof[]> => {
        const repo = initService.getRepo();
        const db = (repo.proofRepository as any).db;
        if (!db) throw new Error('DB not available');
        const rows = await db.all(
            `SELECT mintUrl, id, amount, secret, C, dleqJson, witnessJson, state, usedByOperationId, createdByOperationId FROM coco_cashu_proofs WHERE state = ?`,
            [state]
        );
        return rows.map((r: any) => ({
            id: r.id,
            amount: r.amount,
            secret: r.secret,
            C: r.C,
            mintUrl: r.mintUrl,
            state: r.state,
            ...(r.dleqJson ? { dleq: JSON.parse(r.dleqJson) } : {}),
            ...(r.witnessJson ? { witness: JSON.parse(r.witnessJson) } : {}),
            ...(r.usedByOperationId ? { usedByOperationId: r.usedByOperationId } : {}),
            ...(r.createdByOperationId ? { createdByOperationId: r.createdByOperationId } : {}),
        }));
    },

    /**
     * Delete specific proofs (by secret) for a given mint from the local DB.
     * WARNING: this is destructive — only call for spent or manually-managed proofs.
     */
    deleteProofs: async (mintUrl: string, secrets: string[]): Promise<void> => {
        const repo = initService.getRepo();
        return repo.proofRepository.deleteProofs(mintUrl, secrets);
    },

    /**
     * Encode a set of ready proofs for a given mint into a shareable Cashu token string.
     * This does NOT spend the proofs.
     */
    encodeProofsAsToken: (mintUrl: string, proofs: CoreProof[], unit: string = 'sat'): string => {
        return getEncodedToken({ mint: mintUrl, proofs: proofs as any[], unit });
    },

    /**
     * Get proofs for a specific keyset ID from the local DB.
     */
    getProofsByKeysetId: async (mintUrl: string, keysetId: string): Promise<CoreProof[]> => {
        const repo = initService.getRepo();
        return repo.proofRepository.getProofsByKeysetId(mintUrl, keysetId);
    },
};
