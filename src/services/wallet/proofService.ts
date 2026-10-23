import { Wallet, hasValidDleq, pointFromHex } from '@cashu/cashu-ts';
import { getEncodedToken } from '@cashu/cashu-ts';
import { cleanToken, decodeToken } from '~/services/wallet/tokenUtils';
import type { CoreProof } from 'coco-cashu-core';
import { initService } from '~/services/wallet/initService';
export interface DleqVerificationResult {
  secret: string;
  amount: number;
  valid: boolean;
  status: 'verified' | 'invalid' | 'unverifiable';
  reason?: string;
}
const decodeCache = new Map<string, any>();
type CheckedProofState = Awaited<ReturnType<Wallet['checkProofsStates']>>[number] & {
  secret: string;
};
const pendingStateChecks = new Map<string, Promise<CheckedProofState[]>>();

async function checkProofStates(cleaned: string) {
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
    console.log(
      `[ProofService] Checking state for ${decoded.mint} with ${decoded.proofs.length} proofs`,
    );

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
      secret: decoded.proofs[i].secret, // Attach secret for UI convenience
    }));
  } catch (err: any) {
    console.error(`[ProofService] Failed to check proof states at ${decoded.mint}:`, err);
    return [];
  }
}

export const proofService = {
  /**
   * Check the state of proofs from a token string.
   * Queries the mint to get current proof states (UNSPENT, SPENT, PENDING).
   *
   * @param tokenString - Encoded cashu token string
   * @returns Array of proof state objects from the mint
   */
  checkProofStates: (tokenString: string): Promise<CheckedProofState[]> => {
    const cleaned = cleanToken(tokenString);
    const pending = pendingStateChecks.get(cleaned);
    if (pending) return pending;

    // Share only a currently running request. Completed results must never become a state cache.
    const check = checkProofStates(cleaned).finally(() => pendingStateChecks.delete(cleaned));
    pendingStateChecks.set(cleaned, check);
    return check;
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
      [state],
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
      const { secret, amount, dleq } = proof;
      const result = (
        status: DleqVerificationResult['status'],
        reason?: string,
      ): DleqVerificationResult => ({
        secret,
        amount,
        status,
        valid: status === 'verified',
        reason,
      });

      // Missing data cannot establish validity. In particular, cashu-ts defaults a missing r to zero.
      if (!dleq?.e || !dleq?.s || !dleq?.r) {
        results.push(result('unverifiable', 'Missing required DLEQ e/s/r data'));
        continue;
      }

      const isScalarHex = (value: unknown): value is string =>
        typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
      if (
        !isScalarHex(dleq.e) ||
        !isScalarHex(dleq.s) ||
        !isScalarHex(dleq.r) ||
        typeof secret !== 'string' ||
        !secret.length ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        typeof proof.id !== 'string' ||
        !proof.id.length ||
        typeof proof.C !== 'string' ||
        !/^(02|03)[0-9a-f]{64}$/i.test(proof.C) ||
        proof.mintUrl !== mintUrl
      ) {
        results.push(result('invalid', 'Malformed proof data'));
        continue;
      }

      // Read the exact historical keyset, including inactive keysets. Never fetch or refresh keys.
      let mintPubkey: unknown;
      try {
        const keyset = await repo.keysetRepository.getKeysetById(mintUrl, proof.id);
        if (keyset?.mintUrl === mintUrl && keyset.id === proof.id) {
          const keypair = keyset.keypairs?.[String(amount)];
          mintPubkey = typeof keypair === 'string' ? keypair : keypair?.publicKey;
        }
      } catch {
        // A damaged cache entry must not prevent checking the remaining proofs.
      }
      if (typeof mintPubkey !== 'string' || !/^(02|03)[0-9a-f]{64}$/i.test(mintPubkey)) {
        results.push(result('unverifiable', 'No usable cached denomination key'));
        continue;
      }
      try {
        pointFromHex(mintPubkey);
      } catch {
        results.push(result('unverifiable', 'No usable cached denomination key'));
        continue;
      }

      try {
        const valid = hasValidDleq(proof, { id: proof.id, keys: { [String(amount)]: mintPubkey } });
        results.push(
          result(valid ? 'verified' : 'invalid', valid ? undefined : 'DLEQ verification failed'),
        );
      } catch {
        // Do not expose library errors, which may contain raw proof or key data.
        results.push(result('invalid', 'DLEQ verification failed'));
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
