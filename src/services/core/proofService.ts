import { Wallet } from '@cashu/cashu-ts';
import { getEncodedToken } from '@cashu/cashu-ts';
import { cleanToken, decodeToken } from './tokenUtils';
import type { CoreProof } from 'coco-cashu-core';
import { initService } from './initService';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';

// ── NUT-12 DLEQ helpers ──────────────────────────────────────────────────────
// hash_to_curve: deterministically map a message (secret bytes) to a secp256k1
// point — matches the cashu-ts implementation exactly.
function hashToCurve(secret: Uint8Array): ReturnType<typeof secp256k1.ProjectivePoint.fromHex> {
    let counter = 0;
    while (counter < 1000) {
        const msgToHash = new Uint8Array([...new TextEncoder().encode('Secp256k1_HashToCurve_Cashu_'), ...secret, counter & 0xff]);
        const hash = sha256(msgToHash);
        const prefix = new Uint8Array([0x02]);
        const attempt = new Uint8Array([...prefix, ...hash]);
        try {
            return secp256k1.ProjectivePoint.fromHex(Buffer.from(attempt).toString('hex'));
        } catch {
            counter++;
        }
    }
    throw new Error('hash_to_curve: failed to find valid point after 1000 iterations');
}

export interface DleqVerificationResult {
    secret: string;
    amount: number;
    valid: boolean;
    reason?: string;
}
// ────────────────────────────────────────────────────────────────────────────



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

    /**
     * Verify DLEQ proofs for all locally stored ready proofs at a mint.
     *
     * Fully offline — only uses data already in the DB (dleq + keyset keypairs).
     * This confirms the mint signed honestly using its published keyset public key.
     *
     * @param mintUrl - The mint URL to verify proofs for
     * @returns Array of results, one per proof that has a stored DLEQ
     */
    verifyDleqProofs: async (mintUrl: string): Promise<DleqVerificationResult[]> => {
        const repo = initService.getRepo();

        // Use the existing public repository methods — no raw DB access needed
        const proofs = await repo.proofRepository.getReadyProofs(mintUrl);
        const proofsWithDleq = proofs.filter((p: any) => p.dleq);

        if (proofsWithDleq.length === 0) return [];

        const results: DleqVerificationResult[] = [];

        for (const proof of proofsWithDleq) {
            const { secret, amount, C } = proof as any;
            const dleq = (proof as any).dleq as { e: string; s: string; r?: string };

            try {
                // 1. Validate DLEQ fields exist
                if (!dleq?.e || !dleq?.s) {
                    results.push({ secret, amount, valid: false, reason: 'Missing DLEQ e/s fields' });
                    continue;
                }

                // 2. Fetch the keyset for this proof to get the mint's public key
                const keyset = await repo.keysetRepository.getKeysetById(mintUrl, (proof as any).id);
                if (!keyset) {
                    results.push({ secret, amount, valid: false, reason: 'Keyset not found in local DB' });
                    continue;
                }

                // keypairs is an object: { [amount: string]: { publicKey: string, secretKey: string } }
                // or for some versions just: { [amount: string]: string }
                const keypairs = keyset.keypairs as Record<string, any>;
                const keypairForAmount = keypairs[String(amount)];
                if (!keypairForAmount) {
                    results.push({ secret, amount, valid: false, reason: `No keypair for denomination ${amount}` });
                    continue;
                }

                // Handle both { publicKey: string } and raw string formats
                const mintPubkeyHex: string = typeof keypairForAmount === 'string'
                    ? keypairForAmount
                    : keypairForAmount.publicKey ?? keypairForAmount;

                if (!mintPubkeyHex || typeof mintPubkeyHex !== 'string') {
                    results.push({ secret, amount, valid: false, reason: 'Could not extract mint public key from keypair' });
                    continue;
                }

                // 3. Reconstruct elliptic curve points
                const CPoint = secp256k1.ProjectivePoint.fromHex(C);

                // 4. Derive B_ = hash_to_curve(secret)
                const secretBytes = new TextEncoder().encode(secret);
                const B_Point = hashToCurve(secretBytes);

                // 5. Unblind C → C_ if we have the blinding factor r
                //    During minting: C = C_ + r*B_  so C_ = C - r*B_
                let C_Point = CPoint;
                if (dleq.r) {
                    const rScalar = BigInt('0x' + dleq.r);
                    const rB_ = B_Point.multiply(rScalar);
                    C_Point = CPoint.subtract(rB_);
                }

                // 6. Mint public key point A
                const APoint = secp256k1.ProjectivePoint.fromHex(mintPubkeyHex);

                // 7. Verify the DLEQ equation:
                //    R1 = s*G - e*A
                //    R2 = s*B_ - e*C_
                //    e' = sha256(R1 || R2 || A || B_)  →  must equal stored e
                const eScalar = BigInt('0x' + dleq.e);
                const sScalar = BigInt('0x' + dleq.s);
                const G = secp256k1.ProjectivePoint.BASE;

                const R1 = G.multiply(sScalar).subtract(APoint.multiply(eScalar));
                const R2 = B_Point.multiply(sScalar).subtract(C_Point.multiply(eScalar));

                const hashInput = new Uint8Array([
                    ...R1.toRawBytes(true),
                    ...R2.toRawBytes(true),
                    ...APoint.toRawBytes(true),
                    ...B_Point.toRawBytes(true),
                ]);
                const computedE = Buffer.from(sha256(hashInput)).toString('hex');

                const valid = computedE.toLowerCase() === dleq.e.toLowerCase();
                results.push({ secret, amount, valid, reason: valid ? undefined : 'DLEQ hash mismatch' });
            } catch (err: any) {
                results.push({ secret, amount, valid: false, reason: err.message || 'Unexpected error during DLEQ verification' });
            }
        }

        return results;
    },

    /**
     * Save/insert imported proofs into the DB.
     */
    saveProofs: async (mintUrl: string, proofs: CoreProof[]): Promise<void> => {
        const repo = initService.getRepo();
        return repo.proofRepository.saveProofs(mintUrl, proofs);
    },
};

