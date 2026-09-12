/**
 * Recovery service — handles stuck proofs and proof restoration.
 *
 * Ported from Sovran's CocoManager with adaptations for bey-wallet's
 * service architecture. Provides:
 * - Reserved proof recovery (stuck after failed send/melt)
 * - Inflight proof restoration (stuck after failed melt)
 *
 * These operations access internal Manager services via unsafe casts
 * since the public API doesn't expose all necessary methods.
 */

import { initService } from './initService';

export const recoveryService = {
  /**
   * Free all reserved proofs that are stuck from failed operations.
   *
   * Groups reserved proofs by operationId and attempts to:
   * - Rollback send operations (manager.send.rollback)
   * - Rollback melt operations (meltOperationService.rollback)
   * - Release orphaned reservations directly
   *
   * @returns Summary of recovery actions taken
   */
  freeAllReservedProofs: async (): Promise<{
    totalReservedProofs: number;
    rolledBackSendOperations: number;
    rolledBackMeltOperations: number;
    releasedOrphanedReservations: number;
    errors: { operationId: string; reason: string }[];
  }> => {
    const manager = initService.getManager();

    const unsafeManager = manager as unknown as {
      proofRepository?: {
        getReservedProofs?: () => Promise<
          { mintUrl: string; secret: string; usedByOperationId?: string }[]
        >;
        releaseProofs?: (mintUrl: string, secrets: string[]) => Promise<void>;
      };
      proofService?: {
        releaseProofs?: (mintUrl: string, secrets: string[]) => Promise<void>;
      };
      meltOperationService?: {
        getOperation?: (operationId: string) => Promise<unknown | null>;
        rollback?: (operationId: string, reason?: string) => Promise<void>;
      };
    };

    const proofRepository = unsafeManager.proofRepository;
    const proofService = unsafeManager.proofService;

    if (!proofRepository?.getReservedProofs || !proofRepository?.releaseProofs) {
      console.warn('[RecoveryService] Proof repository does not expose reserved proof access');
      return {
        totalReservedProofs: 0,
        rolledBackSendOperations: 0,
        rolledBackMeltOperations: 0,
        releasedOrphanedReservations: 0,
        errors: [],
      };
    }

    const reservedProofs = await proofRepository.getReservedProofs();
    const totalReservedProofs = reservedProofs.length;

    if (totalReservedProofs === 0) {
      return {
        totalReservedProofs: 0,
        rolledBackSendOperations: 0,
        rolledBackMeltOperations: 0,
        releasedOrphanedReservations: 0,
        errors: [],
      };
    }

    console.log(`[RecoveryService] Found ${totalReservedProofs} reserved proofs`);

    // Group by operationId
    const proofsByOperationId = new Map<
      string,
      { mintUrl: string; secret: string; usedByOperationId?: string }[]
    >();
    const noOperationId: { mintUrl: string; secret: string }[] = [];

    for (const p of reservedProofs) {
      const opId = p.usedByOperationId;
      if (!opId) {
        noOperationId.push({ mintUrl: p.mintUrl, secret: p.secret });
        continue;
      }
      const existing = proofsByOperationId.get(opId) ?? [];
      existing.push(p);
      proofsByOperationId.set(opId, existing);
    }

    let rolledBackSendOperations = 0;
    let rolledBackMeltOperations = 0;
    let releasedOrphanedReservations = 0;
    const errors: { operationId: string; reason: string }[] = [];
    const meltOperationService = unsafeManager.meltOperationService;

    // Helper to release proofs by mint
    const releaseByMint = async (proofs: { mintUrl: string; secret: string }[]) => {
      const byMint = new Map<string, string[]>();
      for (const p of proofs) {
        const list = byMint.get(p.mintUrl) ?? [];
        list.push(p.secret);
        byMint.set(p.mintUrl, list);
      }
      for (const [mintUrl, secrets] of byMint.entries()) {
        if (secrets.length === 0) continue;
        if (proofService?.releaseProofs) {
          await proofService.releaseProofs(mintUrl, secrets);
        } else {
          await proofRepository.releaseProofs!(mintUrl, secrets);
        }
        releasedOrphanedReservations += secrets.length;
      }
    };

    // Release orphaned proofs without operationId
    if (noOperationId.length > 0) {
      await releaseByMint(noOperationId);
    }

    // Process each operation
    for (const [operationId, proofs] of proofsByOperationId.entries()) {
      try {
        // Try send rollback first
        const sendOp = (await manager.send.getOperation(operationId).catch(() => null)) as {
          state?: string;
        } | null;

        if (sendOp) {
          const terminalStates = new Set(['finalized', 'rolled_back']);
          if (terminalStates.has(sendOp.state ?? '')) {
            await releaseByMint(proofs);
          } else {
            await manager.send.rollback(operationId);
            rolledBackSendOperations++;
          }
          continue;
        }

        // Try melt rollback
        const meltOp = meltOperationService?.getOperation
          ? ((await meltOperationService.getOperation(operationId).catch(() => null)) as {
              state?: string;
            } | null)
          : null;

        if (meltOp) {
          const meltTerminalStates = new Set(['finalized', 'rolled_back']);
          if (meltTerminalStates.has(meltOp.state ?? '')) {
            await releaseByMint(proofs);
          } else {
            if (!meltOperationService?.rollback) {
              throw new Error('Melt rollback unavailable');
            }
            await meltOperationService.rollback(operationId, 'Manual recovery');
            rolledBackMeltOperations++;
          }
          continue;
        }

        // No matching operation — release as orphaned
        await releaseByMint(proofs);
      } catch (e) {
        errors.push({
          operationId,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    console.log(
      `[RecoveryService] Recovery complete: ${rolledBackSendOperations} send rollbacks, ${rolledBackMeltOperations} melt rollbacks, ${releasedOrphanedReservations} orphaned released, ${errors.length} errors`,
    );

    return {
      totalReservedProofs,
      rolledBackSendOperations,
      rolledBackMeltOperations,
      releasedOrphanedReservations,
      errors,
    };
  },

  /**
   * Restore inflight proofs to "ready" state for a specific mint.
   * Call this after a melt operation fails to ensure proofs don't stay stuck.
   *
   * @param mintUrl - The mint to restore inflight proofs for
   * @returns Number of proofs restored
   */
  restoreInflightProofsForMint: async (mintUrl: string): Promise<number> => {
    const manager = initService.getManager();

    const unsafeManager = manager as unknown as {
      proofRepository?: {
        getInflightProofs: (urls?: string[]) => Promise<{ mintUrl: string; secret: string }[]>;
      };
      proofService?: {
        restoreProofsToReady: (mintUrl: string, secrets: string[]) => Promise<void>;
      };
    };

    const proofRepo = unsafeManager.proofRepository;
    const proofSvc = unsafeManager.proofService;
    if (!proofRepo?.getInflightProofs || !proofSvc?.restoreProofsToReady) return 0;

    try {
      const inflight = await proofRepo.getInflightProofs([mintUrl]);
      if (inflight.length === 0) return 0;

      const secrets = inflight.map((p) => p.secret);
      await proofSvc.restoreProofsToReady(mintUrl, secrets);
      console.log(`[RecoveryService] ✅ Restored ${secrets.length} inflight proofs on ${mintUrl}`);
      return secrets.length;
    } catch (err) {
      console.warn('[RecoveryService] Failed to restore inflight proofs:', err);
      return 0;
    }
  },
};
