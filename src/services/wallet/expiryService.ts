import { initService } from '~/services/wallet/initService';
import { proofService } from '~/services/wallet/proofService';
import { walletService } from '~/services/wallet/walletService';
import { cleanToken, decodeToken, encodeToken } from '~/services/wallet/tokenUtils';
import { AppState } from 'react-native';
import { seedService } from '~/services/platform/seedService';
import { recoveryCoordinator } from './recoveryCoordinator';
import { appLogger } from '~/shared/utils/appLogger';

let sweepInterval: any = null;
let sweeping = false;
let sweepGeneration = 0;

function canReclaim() {
  // Settings initialization imports wallet services; defer this lifecycle edge.
  const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
  const { useSettingsStore } =
    require('~/state/settingsStore') as typeof import('~/state/settingsStore');
  return (
    AppState.currentState === 'active' &&
    (!useSettingsStore.getState().biometricEnabled || useAuthStore.getState().isAuthenticated)
  );
}

export const expiryService = {
  /**
   * Checks all pending/unclaimed send history entries.
   * Sweeps (refunds) them if they are expired and unspent,
   * or updates their status to 'claimed' if they were spent.
   */
  checkAndSweepExpiredTokens: async (): Promise<void> => {
    if (sweeping || !canReclaim()) return;
    sweeping = true;
    try {
      if (!initService.isInitialized()) return;
      const repo = initService.getRepo();
      if (!repo?.historyRepository) return;

      const db = (repo.historyRepository as any).db;
      if (!db) return;

      // Fetch pending send history entries
      const rows = await db.all(
        `SELECT id, mintUrl, amount, tokenJson, metadata, operationId, state FROM coco_cashu_history
                 WHERE type = 'send' AND (state = 'pending' OR state = 'unclaimed')`,
      );

      for (const row of rows) {
        try {
          if (!row.metadata) continue;
          const metadata = JSON.parse(row.metadata);
          const deadline = metadata.reclaimAt ?? metadata.expiresAt;
          if (!deadline || !Number.isFinite(Number(deadline))) continue;

          // Check if expired
          if (Date.now() >= Number(deadline)) {
            // Parse token
            let tokenStr: string | null = null;
            if (row.tokenJson) {
              try {
                const tokenObj = JSON.parse(row.tokenJson);
                tokenStr = encodeToken(tokenObj);
              } catch (e) {
                appLogger.warn(
                  '[ExpiryService] Failed to parse/encode token for row …:',
                  e,
                  'wallet_sdk',
                );
              }
            }

            if (!tokenStr) continue;

            // Check proof states with the mint

            const states = await proofService.checkProofStates(tokenStr);
            if (
              !states ||
              states.length === 0 ||
              states.length !== decodeToken(cleanToken(tokenStr)).proofs.length
            ) {
              continue;
            }

            const allSpent = states.every((s: any) => s.state === 'SPENT');
            if (allSpent) {
              // Recipient has claimed it, update state to claimed

              await repo.historyRepository.updateHistoryEntryState(String(row.id), 'claimed');

              // Delete local inflight proofs if any
              try {
                const decoded = decodeToken(cleanToken(tokenStr));
                const secrets = decoded.proofs.map((p: any) => p.secret);
                if (secrets.length > 0) {
                  await repo.proofRepository.deleteProofs(row.mintUrl, secrets);
                }
              } catch (e) {}
            } else if (states.every((s: any) => s.state === 'UNSPENT')) {
              // Unspent, sweep/refund it!

              try {
                if (!canReclaim()) return;
                if (metadata.reclaimAt) {
                  const mnemonic = await seedService.getMnemonic();
                  if (!mnemonic) continue;
                  const keys = await seedService.getNostrKeys(mnemonic);
                  if (metadata.refundPubkey !== '02' + keys.pubkey || !canReclaim()) continue;
                  await walletService.receiveP2PK(tokenStr, keys.privkey);
                } else {
                  await walletService.receive(tokenStr);
                }

                // Mark history entry as expired (refunded)
                await repo.historyRepository.updateHistoryEntryState(
                  String(row.id),
                  metadata.reclaimAt ? 'refunded' : 'expired',
                );

                // Delete local inflight proofs if any
                try {
                  const decoded = decodeToken(cleanToken(tokenStr));
                  const secrets = decoded.proofs.map((p: any) => p.secret);
                  if (secrets.length > 0) {
                    await repo.proofRepository.deleteProofs(row.mintUrl, secrets);
                  }
                } catch (e) {}
              } catch (sweepErr: any) {
                appLogger.error('[ExpiryService] Sweep failed for row …:', sweepErr, 'wallet_sdk');
              }
            }
          }
        } catch (rowErr) {
          appLogger.error('[ExpiryService] Error processing row …:', rowErr, 'wallet_sdk');
        }
      }
    } catch (err) {
      appLogger.error('[ExpiryService] Background sweep error:', err, 'wallet_sdk');
    } finally {
      sweeping = false;
    }
  },

  /**
   * Retrieve the expiry info for a token based on its proof secrets.
   * Checks our local history repository to see if we have recorded this transaction.
   */
  getExpiryBySecrets: async (
    secrets: string[],
  ): Promise<{ expiresAt: number; expiryHours: number } | null> => {
    try {
      if (!initService.isInitialized() || secrets.length === 0) return null;
      const repo = initService.getRepo();
      const db = (repo.historyRepository as any).db;
      if (!db) return null;

      // Fetch pending/unclaimed send history entries to look for matching secrets
      const rows = await db.all(
        `SELECT metadata, tokenJson FROM coco_cashu_history WHERE type = 'send' AND (state = 'pending' OR state = 'unclaimed')`,
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
                expiryHours: Number(meta.expiryHours || 0),
              };
            }
          }
        } catch {}
      }
    } catch (e) {
      appLogger.warn('[ExpiryService] getExpiryBySecrets failed:', e, 'wallet_sdk');
    }
    return null;
  },

  /**
   * Start the periodic background sweeper.
   * Uses recursive setTimeout so sweeps never overlap — the next run is
   * scheduled only after the current one finishes.
   */
  startSweeper: (intervalMs = 60000): void => {
    if (sweepInterval) clearTimeout(sweepInterval);
    const generation = ++sweepGeneration;
    const sweep = () =>
      recoveryCoordinator.maintenance('expiry:sweep', () =>
        expiryService.checkAndSweepExpiredTokens(),
      );

    const scheduleNext = () => {
      if (generation !== sweepGeneration) return;
      sweepInterval = setTimeout(async () => {
        try {
          await sweep();
        } catch (e) {
          appLogger.error('[ExpiryService] Sweep error (scheduling next):', e, 'wallet_sdk');
        }
        scheduleNext();
      }, intervalMs);
    };

    // Initial run — fire immediately, then schedule periodic checks
    sweep().catch((e) =>
      appLogger.error('[ExpiryService] Initial sweep error:', undefined, 'wallet_sdk'),
    );
    scheduleNext();
  },

  /**
   * Stop the periodic background sweeper.
   */
  stopSweeper: (): void => {
    sweepGeneration++;
    if (sweepInterval) {
      clearTimeout(sweepInterval);
      sweepInterval = null;
    }
  },
};
