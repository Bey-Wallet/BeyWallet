import { recoveryCoordinator, yieldWalletWork } from '~/services/wallet/recoveryCoordinator';
import { publishWalletFeedback, quoteFeedbackId } from '~/services/feedback/feedbackCoordinator';
const feedbackStartedAt = Date.now();
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { initService, walletService, mintManager, quotesService } from '~/services/wallet';
import type { MintInfo } from '~/services/wallet';
import { useSettingsStore } from '~/state/settingsStore';
import {
  useRecoverySessionStore,
  updateRecoverySession,
  holdRecoveryPause,
  releaseRecoveryPause,
} from './recoverySessionStore';
import { normalizeMintUrl } from '~/shared/utils/mintUrl';
import { InteractionManager } from 'react-native';
import { Mint as CashuMint, Wallet, OutputData } from '@cashu/cashu-ts';

export type MintRestoreStatus = 'pending' | 'scanning' | 'done' | 'partial' | 'error';

export interface MintRestoreEntry {
  mintUrl: string;
  status: MintRestoreStatus;
  restoredBalance: number;
  slow?: boolean;
  error?: string;
}

interface WalletState {
  activeMintUrl: string | null;
  balance: number;
  isInitializing: boolean;
  error: string | null;
  mints: MintInfo[];
  refreshCounter: number;
  balances: Record<string, number>;
  isRestoring: boolean;
  restoringMintUrl: string | null;
  restoreQueue: string[];
  scannerResult: string | null;
  isRefreshing: boolean;
  isCheckingPendingOnchain: boolean;
  mintRestoreStatuses: MintRestoreEntry[];
  restoringMintKeysetProgress: {
    current: number;
    total: number;
    keysetId: string;
    statusText: string;
  } | null;

  // Actions
  initialize: () => Promise<void>;
  setActiveMint: (url: string) => void;
  addMint: (url: string, options?: { trusted?: boolean }) => Promise<void>;
  trustMint: (url: string) => Promise<void>;
  untrustMint: (url: string) => Promise<void>;
  removeMint: (url: string) => Promise<void>;
  setMintNickname: (url: string, nickname: string) => Promise<void>;
  fetchMintInfo: (url: string) => Promise<any>;
  refreshBalance: () => Promise<void>;
  refreshMintList: () => Promise<void>;
  recoverSelectedMints: (mintUrls: string[]) => Promise<void>;
  setScannerResult: (result: string | null) => void;
  syncMintsToNostr: () => Promise<void>;
  autoCheckPendingOnchainQuotes: () => Promise<void>;
  cleanSpentProofs: () => Promise<void>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      activeMintUrl: null,
      balance: 0,
      isInitializing: false,
      error: null,
      mints: [],
      refreshCounter: 0,
      balances: {},
      isRestoring: false,
      restoringMintUrl: null,
      restoreQueue: [],
      scannerResult: null,
      isRefreshing: false,
      isCheckingPendingOnchain: false,
      mintRestoreStatuses: [],
      restoringMintKeysetProgress: null,

      initialize: async () => {
        set({ isInitializing: true, error: null });
        console.log('[WalletStore] Starting initialization...');
        try {
          const walletExists = await initService.walletExists();
          if (!walletExists) {
            console.log('[WalletStore] No wallet exists, skipping initialization');
            set({ isInitializing: false });
            return;
          }

          const manager = await initService.init();

          // Ensure the user's default mint exists and is trusted
          // BUT only if defaultMintUrl is explicitly set (not empty — offline wallets start with '')
          const userDefaultMint = useSettingsStore.getState().defaultMintUrl;
          const existingMints = await manager.mint.getAllMints();

          if (userDefaultMint && userDefaultMint.length > 0) {
            const hasDefault = existingMints.some((m) => m.mintUrl === userDefaultMint);

            if (!hasDefault) {
              try {
                await mintManager.addMint(userDefaultMint, { trusted: true });
              } catch (e) {
                console.warn('[WalletStore] Failed to add default mint (possibly offline):', e);
              }
            } else {
              const isTrusted = await manager.mint.isTrustedMint(userDefaultMint);
              if (!isTrusted) {
                await mintManager.trustMint(userDefaultMint);
              }
            }
          }

          // Set active mint if not set
          // If no mints exist at all, activeMintUrl stays null
          if (!get().activeMintUrl) {
            const freshMints = await manager.mint.getAllMints();
            if (freshMints.length > 0) {
              const defaultUrl =
                userDefaultMint && userDefaultMint.length > 0
                  ? userDefaultMint
                  : freshMints[0].mintUrl;
              set({ activeMintUrl: defaultUrl });
            } else {
              // Zero-mint wallet — activeMintUrl stays null
              set({ activeMintUrl: null });
            }
          }

          // Parallelize balance refresh + mint info fetch for speed
          const [, mintInfos] = await Promise.all([
            get().refreshBalance(),
            mintManager.getMintInfoList(),
          ]);

          const allMints = await manager.mint.getAllMints();

          set({
            isInitializing: false,
            mints: mintInfos,
          });

          // Defer keyset repair to background — never blocks startup
          // Only run if there are mints to repair
          if (allMints.length > 0) {
            const generation = recoveryCoordinator.generation;
            InteractionManager.runAfterInteractions(async () => {
              try {
                const repairResults: boolean[] = [];
                for (const mint of allMints) {
                  if (generation !== recoveryCoordinator.generation) return;
                  await recoveryCoordinator.maintenance(`repair:${mint.mintUrl}`, async () => {
                    repairResults.push(await mintManager.repairMintKeysets(mint.mintUrl, 'sat'));
                  });
                }
                if (generation !== recoveryCoordinator.generation) return;
                if (repairResults.some((r) => r === true)) {
                  console.log('[WalletStore] Keysets repaired in background, refreshing...');
                  await get().refreshBalance();
                  const freshMintInfos = await mintManager.getMintInfoList();
                  set({ mints: freshMintInfos });
                }
              } catch (e) {
                console.warn('[WalletStore] Background keyset repair error:', e);
              }
            });
          }
          console.log('[WalletStore] Initialization complete');
        } catch (err: any) {
          console.error('[WalletStore] Initialization failed:', err);
          set({ error: err.message, isInitializing: false });
        }
      },

      setActiveMint: (url: string) => {
        set({ activeMintUrl: url });
        get().refreshBalance();
      },

      addMint: async (url: string, options?: { trusted?: boolean }) => {
        try {
          // Fast path — only trust the mint, same as Sovran's addMint
          await mintManager.addMint(url, options);

          const mintInfos = await mintManager.getMintInfoList();

          set({
            activeMintUrl: url,
            mints: mintInfos,
          });

          get().refreshBalance();

          // Defer heavy background work AFTER all sheet animations settle
          // This matches Sovran — addMint never blocks the UI thread
          InteractionManager.runAfterInteractions(() => {
            console.log(`[WalletStore] 🔄 Background: repair keysets for: ${url}`);
            void recoveryCoordinator
              .maintenance(`repair:${url}`, async () => {
                await mintManager.repairMintKeysets(url, 'sat');
              })
              .catch(() => console.warn('[WalletStore] Keyset repair failed.'));
            get().syncMintsToNostr();
          });
        } catch (err: any) {
          console.error('[WalletStore] Failed to add mint:', err);
          set({ error: err.message });
        }
      },

      trustMint: async (url: string) => {
        try {
          await mintManager.trustMint(url);
          const mintInfos = await mintManager.getMintInfoList();
          set({ mints: mintInfos });
          InteractionManager.runAfterInteractions(() => {
            get().syncMintsToNostr();
          });
        } catch (err: any) {
          console.error('[WalletStore] Failed to trust mint:', err);
          set({ error: err.message });
        }
      },

      refreshBalance: async () => {
        try {
          set({ isRefreshing: true, error: null });
          if (!initService.isInitialized()) {
            set({ balance: 0, isRefreshing: false });
            return;
          }

          const activeUrl = get().activeMintUrl;
          if (!activeUrl) {
            set({ balance: 0, isRefreshing: false });
            return;
          }

          // Single DB call — derive active mint balance from the map
          const balances = await walletService.getBalances();
          const balance = balances[activeUrl] ?? 0;

          set({ balance, balances, refreshCounter: get().refreshCounter + 1, isRefreshing: false });

          // Auto-check and redeem pending on-chain quotes in the background
          InteractionManager.runAfterInteractions(() => {
            get()
              .autoCheckPendingOnchainQuotes()
              .catch((err) => {
                console.warn('[WalletStore] Background pending on-chain quote check failed:', err);
              });
            get()
              .cleanSpentProofs()
              .catch((err) => {
                console.warn('[WalletStore] Background spent proofs clean failed:', err);
              });
          });
        } catch (err: any) {
          console.error('[WalletStore] Error refreshing balance:', err);
          set({ error: err.message, isRefreshing: false });
        }
      },

      untrustMint: async (url: string) => {
        try {
          await mintManager.untrustMint(url);
          await get().refreshMintList();
          InteractionManager.runAfterInteractions(() => {
            get().syncMintsToNostr();
          });
        } catch (err: any) {
          console.error('[WalletStore] Failed to untrust mint:', err);
          set({ error: err.message });
        }
      },

      removeMint: async (url: string) => {
        try {
          await mintManager.removeMint(url);
          await get().refreshMintList();
          if (get().activeMintUrl === url) {
            const userDefaultMint = useSettingsStore.getState().defaultMintUrl;
            // If defaultMintUrl is set and isn't the removed one, use it
            if (userDefaultMint && userDefaultMint.length > 0 && url !== userDefaultMint) {
              set({ activeMintUrl: userDefaultMint });
            } else {
              const nextActive = get().mints.find((m) => m.mintUrl !== url)?.mintUrl;
              set({ activeMintUrl: nextActive || null });
            }
          }
          await get().refreshBalance();
          InteractionManager.runAfterInteractions(() => {
            get().syncMintsToNostr();
          });
        } catch (err: any) {
          console.error('[WalletStore] Failed to remove mint:', err);
          set({ error: err.message });
          throw err;
        }
      },

      fetchMintInfo: async (url: string) => {
        try {
          return await mintManager.getMintInfo(url);
        } catch (err: any) {
          console.error('[WalletStore] Failed to fetch mint info:', err);
          throw err;
        }
      },

      refreshMintList: async () => {
        try {
          set({ isRefreshing: true });
          const mintInfos = await mintManager.getMintInfoList();
          set({ mints: mintInfos, isRefreshing: false });
        } catch (err: any) {
          console.error('[WalletStore] Failed to refresh mint list:', err);
          set({ isRefreshing: false });
        }
      },

      setMintNickname: async (url: string, nickname: string) => {
        try {
          await mintManager.setMintNickname(url, nickname);
          await get().refreshMintList();
        } catch (err: any) {
          console.error('[WalletStore] Failed to set mint nickname:', err);
          set({ error: err.message });
        }
      },

      recoverSelectedMints: (mintUrls) => {
        if (batchRestore || get().isRestoring || get().restoreQueue.length)
          return Promise.reject(new Error('Another recovery is already running.'));
        const urls = [...new Set(mintUrls.map(normalizeMintUrl))];
        if (!urls.length) return Promise.reject(new Error('Select at least one mint.'));
        const session = useRecoverySessionStore.getState().session;
        if (!session || urls.some((url) => !session.candidates.some((c) => c.mintUrl === url)))
          return Promise.reject(new Error('Review the selected mints first.'));
        if (
          session.origin === 'manual' &&
          urls.some(
            (url) =>
              !get().mints.some((mint) => mint.trusted && normalizeMintUrl(mint.mintUrl) === url),
          )
        )
          return Promise.reject(
            new Error('A selected mint is no longer trusted. Review your mints.'),
          );
        holdRecoveryPause();
        updateRecoverySession({
          feedbackId: session.feedbackId ?? `recovery-${Date.now()}`,
          phase: 'recovering',
          selected: session.phase === 'review' ? urls : session.selected,
          results:
            session.phase === 'review'
              ? []
              : session.results.filter((result) => !urls.includes(result.mintUrl)),
          needsReview: true,
        });
        batchRestore = Promise.all(urls.map(queueMintRecovery))
          .then(() => undefined)
          .finally(() => {
            updateRecoverySession({ phase: 'results' });
            batchRestore = null;
            releaseRecoveryPause();
            const completed = useRecoverySessionStore.getState().session;
            if (
              completed?.feedbackId &&
              completed.results.some((result) => result.status !== 'done')
            )
              void publishWalletFeedback({
                entity: { type: 'recovery', id: completed.feedbackId },
                kind: 'recovery',
                state: 'review',
                origin: 'live',
                target: { type: 'recovery' },
              });
          });
        return batchRestore;
      },

      setScannerResult: (result: string | null) => {
        set({ scannerResult: result });
      },

      syncMintsToNostr: async () => {
        const { publishMintBackup } = await import('~/services/wallet/mintBackupService');
        await publishMintBackup(true);
      },

      autoCheckPendingOnchainQuotes: async () => {
        const activeUrl = get().activeMintUrl;
        if (!activeUrl || !initService.isInitialized() || get().isCheckingPendingOnchain) return;

        set({ isCheckingPendingOnchain: true });
        try {
          const repo = initService.getRepo();
          const history = await repo.historyRepository.getPaginatedHistoryEntries(100, 0);

          // 1. Process Pending Deposits (Mints)
          const pendingOnchainMints = history.filter(
            (h): h is Extract<(typeof history)[number], { type: 'mint' }> =>
              h.type === 'mint' &&
              String(h.state).toLowerCase() === 'pending' &&
              h.metadata?.via === 'onchain',
          );

          for (const entry of pendingOnchainMints) {
            const metadata = entry.metadata as unknown as {
              via?: string;
              privKey?: string;
            };
            try {
              console.log(
                `[WalletStore] Auto-checking pending on-chain deposit quote ${entry.quoteId} for mint ${entry.mintUrl}`,
              );
              const status = await quotesService.checkOnchainMintQuote(
                entry.mintUrl,
                entry.quoteId,
              );
              const delta = status.amount_paid - status.amount_issued;
              if (delta > 0 && metadata.privKey) {
                console.log(
                  `[WalletStore] Pending on-chain quote ${entry.quoteId} has been paid! Redeeming ${delta} sat...`,
                );
                await quotesService.redeemOnchainMintQuote(
                  entry.mintUrl,
                  entry.quoteId,
                  metadata.privKey,
                );
                get().refreshBalance();
              }
            } catch (err) {
              console.warn(`[WalletStore] Failed checking pending quote ${entry.quoteId}:`, err);
            }
          }

          // 2. Process Pending Withdrawals (Melts)
          const pendingOnchainMelts = history.filter(
            (h): h is Extract<(typeof history)[number], { type: 'melt' }> =>
              h.type === 'melt' &&
              String(h.state).toLowerCase() === 'pending' &&
              h.metadata?.via === 'onchain',
          );

          for (const entry of pendingOnchainMelts) {
            const metadata = entry.metadata as unknown as {
              via?: string;
              changeOutputs?: any[];
              inputs?: Array<{ secret: string }>;
            };
            try {
              console.log(
                `[WalletStore] Auto-checking pending on-chain melt quote ${entry.quoteId} for mint ${entry.mintUrl}`,
              );
              const status = await quotesService.checkOnchainMeltQuote(
                entry.mintUrl,
                entry.quoteId,
              );

              if (status.state === 'PAID') {
                console.log(
                  `[WalletStore] Pending on-chain melt ${entry.quoteId} was paid! Finalizing...`,
                );
                const m = initService.getManager() as any;

                // Claim change proofs if any
                if (status.change && status.change.length > 0 && metadata.changeOutputs) {
                  const wallet = new Wallet(new CashuMint(entry.mintUrl));
                  await wallet.loadMint();
                  const keyset = wallet.getKeyset(status.change[0].id);

                  const outputData = metadata.changeOutputs.map((h: any) => {
                    // Deserialize Uint8Array from hex string
                    const secretBytes = new Uint8Array(
                      h.secret.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)),
                    );
                    return new OutputData(h.blindedMessage, BigInt(h.blindingFactor), secretBytes);
                  });

                  const changeProofs = status.change.map((sig: any, idx: number) => {
                    return outputData[idx].toProof(sig, keyset);
                  });

                  const changeCoreProofs = changeProofs.map((p: any) => ({
                    ...p,
                    mintUrl: entry.mintUrl,
                    state: 'ready' as const,
                  }));
                  await repo.proofRepository.saveProofs(entry.mintUrl, changeCoreProofs);
                  console.log(`[WalletStore] Claimed ${changeProofs.length} change proofs`);
                }

                // Mark inputs as spent
                if (metadata.inputs) {
                  const secrets = metadata.inputs.map((p) => p.secret);
                  await m.proofService.setProofState(entry.mintUrl, secrets, 'spent');
                }

                // Update history
                await repo.historyRepository.updateHistoryMeltEntry(
                  entry.mintUrl,
                  entry.quoteId,
                  'paid',
                );
                await publishWalletFeedback({
                  entity: { type: 'quote', id: quoteFeedbackId(entry.mintUrl, entry.quoteId) },
                  parentOperationId: entry.quoteId,
                  kind: 'sent',
                  state: 'completed',
                  origin: entry.createdAt >= feedbackStartedAt ? 'live' : 'catch-up',
                  target: { type: 'transaction', id: String(entry.id) },
                });
                get().refreshBalance();
              } else if (status.state === 'UNPAID') {
                console.log(
                  `[WalletStore] Pending on-chain melt ${entry.quoteId} failed/unpaid. Reclaiming inputs...`,
                );
                const m = initService.getManager() as any;

                // Restore inputs back to ready
                if (metadata.inputs) {
                  const secrets = metadata.inputs.map((p) => p.secret);
                  await m.proofService.setProofState(entry.mintUrl, secrets, 'ready');
                }

                // Update history to failed
                await repo.historyRepository.updateHistoryMeltEntry(
                  entry.mintUrl,
                  entry.quoteId,
                  'failed',
                );
                get().refreshBalance();
              }
            } catch (err) {
              console.warn(
                `[WalletStore] Failed checking pending melt quote ${entry.quoteId}:`,
                err,
              );
            }
          }
        } catch (e) {
          console.warn('[WalletStore] Failed to auto-check pending on-chain quotes:', e);
        } finally {
          set({ isCheckingPendingOnchain: false });
        }
      },

      cleanSpentProofs: async () => {
        const activeUrl = get().activeMintUrl;
        if (!activeUrl || !initService.isInitialized()) return;

        return recoveryCoordinator.maintenance(`cleanup:${activeUrl}`, async () => {
          try {
            const repo = initService.getRepo();
            const m = initService.getManager() as any;
            const readyProofs = await repo.proofRepository.getReadyProofs(activeUrl);
            if (readyProofs.length === 0) return;

            console.log(
              `[WalletStore] Checking spendable state for ${readyProofs.length} ready proofs on ${activeUrl}...`,
            );
            const wallet = new Wallet(new CashuMint(activeUrl));
            const states = await wallet.checkProofsStates(
              readyProofs.map((p) => ({ secret: p.secret, amount: p.amount, C: p.C, id: p.id })),
            );

            const spentSecrets: string[] = [];
            states.forEach((s, idx) => {
              if (s.state === 'SPENT') {
                spentSecrets.push(readyProofs[idx].secret);
              }
            });

            if (spentSecrets.length > 0) {
              console.log(
                `[WalletStore] Found ${spentSecrets.length} spent proofs locally. Setting them to spent...`,
              );
              await m.proofService.setProofState(activeUrl, spentSecrets, 'spent');
              await get().refreshBalance();
            } else {
              console.log('[WalletStore] All local proofs are fresh and unspent!');
            }
          } catch (e) {
            console.warn('[WalletStore] Failed to clean spent proofs:', e);
          }
        });
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        activeMintUrl: state.activeMintUrl,
        balance: state.balance,
        balances: state.balances,
        mints: state.mints,
      }),
    },
  ),
);

let batchRestore: Promise<void> | null = null;

function queueMintRecovery(mintUrl: string): Promise<void> {
  const store = useWalletStore;
  store.setState((state) => ({
    isRestoring: true,
    restoreQueue: [...state.restoreQueue, mintUrl],
    mintRestoreStatuses: [
      ...state.mintRestoreStatuses.filter((entry) => entry.mintUrl !== mintUrl),
      { mintUrl, status: 'pending', restoredBalance: 0 },
    ],
  }));
  const updateEntry = (change: Partial<MintRestoreEntry>) =>
    store.setState((state) => ({
      mintRestoreStatuses: state.mintRestoreStatuses.map((entry) =>
        entry.mintUrl === mintUrl ? { ...entry, ...change } : entry,
      ),
    }));
  const finish = () =>
    store.setState((state) => {
      const restoreQueue = state.restoreQueue.filter((url) => url !== mintUrl);
      return {
        restoreQueue,
        isRestoring: restoreQueue.length > 0,
        restoringMintUrl: null,
        restoringMintKeysetProgress: null,
      };
    });
  return recoveryCoordinator
    .enqueue(mintUrl, async () => {
      store.setState({ restoringMintUrl: mintUrl, restoringMintKeysetProgress: null });
      updateEntry({ status: 'scanning', slow: false, error: undefined });
      const slow = setTimeout(() => updateEntry({ slow: true }), 12_000);
      try {
        await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(resolve));
        await mintManager.addMint(mintUrl, { trusted: true });
        if (!store.getState().activeMintUrl) store.setState({ activeMintUrl: mintUrl });
        const report = await walletService.restore(mintUrl);
        updateEntry({
          status: report.partial ? 'partial' : 'done',
          error: report.partial ? 'Some keysets could not be scanned. Retry recovery.' : undefined,
        });
      } catch {
        updateEntry({
          status: 'error',
          error: 'Recovery could not finish. Retry when the mint is available.',
        });
        // Retain the existing failure recovery path, after the scan has actually settled.
        await walletService.restoreInflightProofs(mintUrl).catch(() => undefined);
      } finally {
        clearTimeout(slow);
        try {
          await store.getState().refreshBalance();
          const balances = await walletService.getBalances();
          updateEntry({ restoredBalance: balances[mintUrl] ?? 0, slow: false });
          await store.getState().refreshMintList();
        } finally {
          finish();
        }
        await yieldWalletWork();
      }
      const entry = store.getState().mintRestoreStatuses.find((item) => item.mintUrl === mintUrl);
      const session = useRecoverySessionStore.getState().session;
      if (session?.phase === 'recovering' && entry) {
        updateRecoverySession({
          results: [
            ...session.results.filter((item) => item.mintUrl !== mintUrl),
            {
              mintUrl,
              status: entry.status as 'done' | 'partial' | 'error',
              balance: entry.restoredBalance,
            },
          ],
        });
      }
    })
    .catch(() => {
      updateEntry({ status: 'error', error: 'Wallet is unavailable. Retry recovery.' });
      finish();
      const session = useRecoverySessionStore.getState().session;
      if (session?.phase === 'recovering')
        updateRecoverySession({
          results: [
            ...session.results.filter((item) => item.mintUrl !== mintUrl),
            { mintUrl, status: 'error', balance: store.getState().balances[mintUrl] ?? 0 },
          ],
        });
    });
}
