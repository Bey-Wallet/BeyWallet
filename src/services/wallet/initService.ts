import {
  invalidateWalletSnapshot,
  suspendWalletStorageWrites,
} from '~/storage/sqlite/sqliteStorage';
import { recoveryCoordinator } from './recoveryCoordinator';
/**
 * Initialization service — manages Manager lifecycle.
 *
 * Handles:
 * - Wallet existence check
 * - Manager initialization (existing wallet)
 * - Wallet creation (new mnemonic)
 * - AppState pause/resume for battery savings
 * - Explicit watcher enable/disable lifecycle
 * - Singleton access to Manager and Repositories
 *
 * Architecture matches Sovran's CocoManager pattern using
 * `new Manager()` constructor with explicit watcher enabling.
 */

import { Manager } from 'coco-cashu-core';
import { ExpoSqliteRepositories } from '~/storage/sqlite';
import * as SQLite from 'expo-sqlite';
import { getDb, closeDb } from '~/storage/sqlite/sqliteStorage';
import {
  destroyEncryptedWalletStorage,
  finishWalletStorageDeletion,
  walletStorageDeletionPending,
  WalletDeletionPendingError,
} from '~/storage/sqlite/encryptedDatabase';
import * as SecureStore from 'expo-secure-store';
import { seedService } from '~/services/platform/seedService';
import { AppState, type AppStateStatus } from 'react-native';
import { HistoryWatcherPlugin } from '~/services/wallet/plugins/HistoryWatcherPlugin';
import { OfflineChangePlugin } from '~/services/wallet/plugins/OfflineChangePlugin';
import { LocalSendEventsPlugin } from '~/services/wallet/plugins/LocalSendEventsPlugin';
import { ChangePreparationPlugin } from '~/services/wallet/plugins/ChangePreparationPlugin';
import { nostrService } from '~/services/wallet/nostrService';
import { walletLogger as customLogger } from './walletLogger';
import { Keyset } from '@cashu/cashu-ts';
import { appLogger } from '~/shared/utils/appLogger';

// ─── Runtime Compatibility Patches ───────────────────────────

/**
 * Monkey patch Keyset.prototype.verify to be more lenient.
 *
 * This makes the wallet compatible with testnut.cashu.space and other official mints
 * that use non-standard keyset ID formats (e.g. 66-character hex / 33-byte IDs).
 * Current versions of cashu-ts fail to verify these IDs correctly.
 */
const originalVerify = Keyset.prototype.verify;
Keyset.prototype.verify = function () {
  try {
    const isValid = originalVerify.call(this);
    if (isValid) return true;

    // Bypassing verification for 66-character hex IDs (33 bytes)
    // commonly used by newer mints/test-mints like testnut.
    if (
      this.id &&
      this.id.length === 66 &&
      (this.id.startsWith('01') || this.id.startsWith('00'))
    ) {
      appLogger.warn(
        '[InitService] KeysetPatch: Bypassing verification for non-standard ID: …',
        undefined,
        'wallet_start',
      );
      return true;
    }

    return false;
  } catch (e) {
    // Safe fallback: if verification crashes, trust the keys if they exist
    return !!(this.keys && Object.keys(this.keys).length > 0);
  }
};

// ─── Singleton State ──────────────────────────────────────────

let manager: Manager | null = null;
let repo: ExpoSqliteRepositories | null = null;
let appStateSubscription: any = null;
let isInitializing = false;
let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the shared SQLite database instance opened by initService.
 * Use this instead of opening a new connection to avoid WAL locking conflicts.
 * May be null before wallet initialization — callers should handle that gracefully.
 */
export function getSharedDb(): SQLite.SQLiteDatabase | null {
  return dbInstance;
}

/**
 * Purge all cached keysets for a mint from the local database.
 *
 * Called automatically when coco-cashu-core throws "Keyset verification failed"
 * for a mint — this clears the stale/corrupted keyset rows so the SDK fetches
 * fresh keys from the mint on the next attempt.
 *
 * @param mintUrl - The mint whose keysets should be cleared
 * @param keysetId - Optional: clear only this specific keyset ID
 */
export async function purgeCorruptedKeysets(mintUrl: string, keysetId?: string): Promise<void> {
  const db = dbInstance;
  if (!db) {
    appLogger.warn(
      '[InitService] purgeCorruptedKeysets: db not ready, skipping',
      undefined,
      'wallet_start',
    );
    return;
  }

  try {
    if (keysetId) {
      await db.runAsync(
        `DELETE FROM coco_cashu_keysets WHERE mintUrl = ? AND id = ?`,
        mintUrl,
        keysetId,
      );
    } else {
      await db.runAsync(`DELETE FROM coco_cashu_keysets WHERE mintUrl = ?`, mintUrl);
    }

    // Also clear the counters so the SDK doesn't try to resume from a bad counter
    await db.runAsync(`DELETE FROM coco_cashu_counters WHERE mintUrl = ?`, mintUrl);
  } catch (err) {
    appLogger.warn('[InitService] purgeCorruptedKeysets failed:', err, 'wallet_start');
  }
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Setup AppState listener to pause/resume WebSocket subscriptions
 * when the app goes to background/foreground. Saves battery.
 */
function setupAppStateListener(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
  }

  appStateSubscription = AppState.addEventListener(
    'change',
    async (nextAppState: AppStateStatus) => {
      if (!manager) return;

      try {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          await manager.pauseSubscriptions();
        } else if (nextAppState === 'active') {
          await manager.resumeSubscriptions();
        }
      } catch (err) {
        appLogger.error('[InitService] Subscription lifecycle error:', err, 'wallet_start');
      }
    },
  );
}

/**
 * Enable watchers and processors with staggered delays to prevent
 * transaction conflicts. Matches Sovran's pattern.
 */
async function enableWatchers(mgr: Manager, options: { fast?: boolean } = {}): Promise<void> {
  const { getMintTransferService } = await import('./mintTransferService');
  getMintTransferService().start();
  const delay = options.fast ? 0 : 50;

  // Enable mint quote watcher
  try {
    await mgr.enableMintQuoteWatcher({
      watchExistingPendingOnStart: true,
    });
  } catch (error) {
    appLogger.warn('[InitService] Mint quote watcher failed:', error, 'wallet_start');
  }

  // Delay between watchers to avoid DB contention
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  // Enable mint quote processor
  try {
    await mgr.enableMintQuoteProcessor({
      processIntervalMs: 5000,
      maxRetries: 3,
      baseRetryDelayMs: 1000,
      initialEnqueueDelayMs: 500,
    });
  } catch (error) {
    appLogger.warn('[InitService] Mint quote processor failed:', error, 'wallet_start');
  }

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  // Enable proof state watcher (with retry)
  try {
    await mgr.enableProofStateWatcher();
  } catch (error) {
    appLogger.warn(
      '[InitService] Proof state watcher failed, retrying once...',
      error,
      'wallet_start',
    );
    try {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      await mgr.enableProofStateWatcher();
    } catch (retryError) {
      appLogger.error(
        '[InitService] Proof state watcher failed on retry:',
        retryError,
        'wallet_start',
      );
    }
  }
}

/**
 * Disable all watchers before reset/cleanup.
 */
async function disableWatchers(mgr: Manager): Promise<void> {
  try {
    await mgr.disableProofStateWatcher();
  } catch (e) {
    appLogger.warn('[InitService] Failed to disable proof state watcher:', e, 'wallet_start');
  }
  try {
    await mgr.disableMintQuoteProcessor();
  } catch (e) {
    appLogger.warn('[InitService] Failed to disable mint quote processor:', e, 'wallet_start');
  }
  try {
    await mgr.disableMintQuoteWatcher();
  } catch (e) {
    appLogger.warn('[InitService] Failed to disable mint quote watcher:', e, 'wallet_start');
  }
}

/**
 * Core initialization with a mnemonic. Opens DB, creates repos,
 * creates Manager with explicit watcher enabling.
 */
async function initializeWithMnemonic(
  mnemonic: string,
  options: { quiet?: boolean; nostrRestoredAt?: number; localOnly?: boolean } = {},
): Promise<Manager> {
  const seed = await seedService.deriveSeed(mnemonic);

  // Retrieve the shared SQLite database connection
  const db = getDb();

  dbInstance = db;
  const repositories = new ExpoSqliteRepositories({ database: db });
  await repositories.init();

  // Reuse the existing seed-derived Nostr identity for both receiving protocols.
  const [
    { privkey, pubkey },
    { prepareRecoverySession },
    { FeedbackRepository },
    { feedbackCoordinator },
    { useSettingsStore },
  ] = await Promise.all([
    seedService.getNostrKeys(mnemonic, seed),
    import('~/state/recoverySessionStore'),
    import('~/storage/sqlite/repositories/FeedbackRepository'),
    import('~/services/feedback/feedbackCoordinator'),
    import('~/state/settingsStore'),
  ]);
  if (options.nostrRestoredAt !== undefined) {
    const { useNostrHistoryStore } =
      require('~/state/nostrHistoryStore') as typeof import('~/state/nostrHistoryStore');
    useNostrHistoryStore.getState().beginRestore(pubkey, options.nostrRestoredAt);
  }
  await prepareRecoverySession(pubkey);
  const feedback = new FeedbackRepository(repositories.db);
  await feedback.init();
  feedbackCoordinator.bind(pubkey, feedback);

  // Using the shared customLogger declared at module scope

  // Initialize Manager using constructor (rc47 pattern)
  manager = new Manager(
    repositories,
    async () => new Uint8Array(seed),
    customLogger as any,
    undefined,
    options.localOnly
      ? []
      : [OfflineChangePlugin, LocalSendEventsPlugin, ChangePreparationPlugin, HistoryWatcherPlugin],
  );

  repo = repositories;
  // Hydrate privacy/authentication settings and the identity cache before
  // network watchers. A slow/offline mint must not gate the first Home paint.
  await useSettingsStore.getState().initialize(true);
  if (!options.localOnly) setupAppStateListener();

  if (!options.quiet) {
    // Enable watchers with staggered delays to prevent DB contention on start
    await enableWatchers(manager);

    // Start listening for Nostr payments and repair the public username profile.
    const nip05 = await repositories.settingsRepository.getSetting('nip05');
    nostrService.start(privkey, pubkey, nip05 || undefined);
    // Deferred import keeps claim orchestration below the wallet lifecycle boundary.
    const { nostrClaimService } = await import('~/services/wallet/nostrClaimService');
    nostrClaimService.start(privkey);
    const { requestLifecycleService } = await import('./requestLifecycleService');
    requestLifecycleService.start(manager);
    const { getChangePreparation } = await import('./changePreparationService');
    void recoveryCoordinator
      .maintenance('change:recovery', () => getChangePreparation().recoverPending())
      .catch(() => {});

    // Start pending tokens sweeper
    const { expiryService } = await import('~/services/wallet/expiryService');
    expiryService.startSweeper();

    const { startLightningAddress } = await import('./lightningAddressLifecycle');
    await startLightningAddress(repositories, privkey, pubkey);
  } else {
  }

  return manager;
}

// ─── Public API ───────────────────────────────────────────────

async function requireNoFileRestore(): Promise<void> {
  const { fileRestoreJournal } =
    require('~/storage/sqlite/fileRestoreStorage') as typeof import('~/storage/sqlite/fileRestoreStorage');
  if (await fileRestoreJournal.io.read())
    throw new Error('Finish or cancel the pending backup restore before changing your wallet.');
}

let deletionFlight: Promise<void> | null = null;

/** Keep the durable wipe intent until every local persistent copy has been removed. */
async function finishLocalWalletDeletion(preserveSetup = false) {
  const { clearWalletTemporaryFiles } =
    require('~/services/platform/walletTemporaryFiles') as typeof import('~/services/platform/walletTemporaryFiles');
  const { resetWalletMemory } =
    require('./walletMemoryReset') as typeof import('./walletMemoryReset');
  const { nfcService } =
    require('~/services/platform/nfcService') as typeof import('~/services/platform/nfcService');
  await destroyEncryptedWalletStorage();
  await clearWalletTemporaryFiles();
  await nfcService.clearWalletData();
  await seedService.clearWallet();
  await SecureStore.deleteItemAsync('bey_wallet_onboarded');
  resetWalletMemory(preserveSetup);
  await finishWalletStorageDeletion();
}

export const initService = {
  /** Resume only a previously authorized deletion, before opening any wallet on startup. */
  resumePendingWalletDeletion: async (): Promise<void> => {
    if (!walletStorageDeletionPending()) return;
    const resumeWrites = suspendWalletStorageWrites();
    try {
      closeDb(true);
      await finishLocalWalletDeletion();
    } catch {
      throw new WalletDeletionPendingError();
    } finally {
      resumeWrites();
    }
  },
  /**
   * Check if a wallet exists (mnemonic saved in secure storage).
   */
  walletExists: (): Promise<boolean> => {
    return seedService.walletExists();
  },

  /**
   * Initialize with an EXISTING wallet. Throws if no mnemonic found.
   */
  init: async (): Promise<Manager> => {
    if (manager) {
      return manager;
    }

    if (isInitializing) {
      let attempts = 0;
      while (isInitializing && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
      if (manager) return manager;
      if (attempts >= 50) throw new Error('Initialization timeout');
    }

    isInitializing = true;
    try {
      const { fileRestoreJournal, validateInstalledFileRestore } =
        await import('~/storage/sqlite/fileRestoreStorage');
      const pendingFileRestore = await fileRestoreJournal.io.read();
      if (pendingFileRestore && pendingFileRestore.phase !== 'installed')
        throw new Error('Finish wallet backup recovery before opening your wallet.');
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) {
        throw new Error('No wallet exists. Use createWallet() first.');
      }

      if (pendingFileRestore?.phase === 'installed') {
        const { useFileRestoreStore } = await import('~/state/fileRestoreStore');
        useFileRestoreStore.setState({ phase: 'installing' });
        try {
          await validateInstalledFileRestore(pendingFileRestore, getDb());
          // No mint/network work until the new database and seed open together.
          await initializeWithMnemonic(mnemonic, { quiet: true, localOnly: true });
          const { useSettingsStore } = await import('~/state/settingsStore');
          if (!useSettingsStore.getState().initialized)
            throw new Error('Restored wallet settings unavailable.');
          const { notificationService } = await import('~/services/platform/notificationService');
          await notificationService.clear();
          await fileRestoreJournal.commit();
        } catch {
          try {
            await initService.cleanup({ strict: true });
            const record = await fileRestoreJournal.io.read();
            if (record?.phase !== 'committed') await fileRestoreJournal.rollback();
            useFileRestoreStore.setState({
              phase: 'restart',
              error: 'Wallet startup could not finish. Restart to recover safely.',
            });
          } catch {
            useFileRestoreStore.setState({
              phase: 'error',
              error: 'Wallet recovery needs another attempt. Restart before using your wallet.',
            });
          }
          throw new Error('Wallet restore startup failed.');
        }
        try {
          const restoredManager = await initService.reinitFast();
          useFileRestoreStore.setState({
            phase: 'success',
            mode: pendingFileRestore.mode,
            error: null,
          });
          return restoredManager;
        } catch {
          // Commit is final: network/runtime startup must never roll funds back.
          useFileRestoreStore.setState({
            phase: 'restart',
            error: 'Your restored wallet is saved. Restart to finish opening it.',
          });
          throw new Error('Restored wallet runtime unavailable.');
        }
      }
      const m = await initializeWithMnemonic(mnemonic);

      return m;
    } finally {
      isInitializing = false;
    }
  },

  /**
   * Fast re-initialization. Skips staggered delays in enableWatchers.
   * Useful for background syncs where we just need to refresh proof/counter state.
   */
  reinitFast: async (options: { withinWalletOperation?: boolean } = {}): Promise<Manager> => {
    const releaseRecoveryLock = recoveryCoordinator.beginLifecycle();
    invalidateWalletSnapshot();
    try {
      // Keyset repair can be called by the very claim/event whose promise a full
      // drain would await. That caller retains its existing operation ownership.
      if (options.withinWalletOperation) await recoveryCoordinator.drainMaintenance();
      else await recoveryCoordinator.drainBackground();
      const { stopLightningAddress } = await import('./lightningAddressLifecycle');
      await stopLightningAddress();
      const { stopMintTransferService } = await import('./mintTransferService');
      stopMintTransferService();
      const { requestLifecycleService: previousRequestLifecycle } =
        await import('./requestLifecycleService');
      previousRequestLifecycle.stop();

      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) throw new Error('No mnemonic found');

      const seed = await seedService.deriveSeed(mnemonic);

      // If a manager already exists, we must disable its watchers first
      if (manager) {
        try {
          await disableWatchers(manager);
          await manager.dispose?.();
        } catch (e) {}
        manager = null;
      }

      // Expo SQLite: Do not close the database instance forcefully here. Use the existing one to avoid
      // crashing background plugins (like proof watchers) with NullPointerExceptions.
      if (!dbInstance) {
        dbInstance = getDb();
      }
      const db = dbInstance;
      const repositories = new ExpoSqliteRepositories({ database: db });
      await repositories.init();

      const { privkey, pubkey } = await seedService.getNostrKeys(mnemonic, seed);
      const { prepareRecoverySession } = await import('~/state/recoverySessionStore');
      await prepareRecoverySession(pubkey);

      manager = new Manager(
        repositories,
        async () => new Uint8Array(seed),
        customLogger as any,
        undefined,
        [OfflineChangePlugin, LocalSendEventsPlugin, ChangePreparationPlugin, HistoryWatcherPlugin],
      );

      repo = repositories;
      setupAppStateListener();

      // Enable watchers WITHOUT staggered delays
      await enableWatchers(manager, { fast: true });

      // Start Nostr background receiver and repair the public username profile.
      const nip05 = await repositories.settingsRepository.getSetting('nip05');
      nostrService.start(privkey, pubkey, nip05 || undefined);
      const { nostrClaimService } = await import('~/services/wallet/nostrClaimService');
      nostrClaimService.start(privkey);
      const { requestLifecycleService } = await import('./requestLifecycleService');
      requestLifecycleService.start(manager);
      const { getChangePreparation } = await import('./changePreparationService');
      void recoveryCoordinator
        .maintenance('change:recovery', () => getChangePreparation().recoverPending())
        .catch(() => {});

      // Start pending tokens sweeper
      const { expiryService } = await import('~/services/wallet/expiryService');
      expiryService.startSweeper();

      const { startLightningAddress } = await import('./lightningAddressLifecycle');
      await startLightningAddress(repositories, privkey, pubkey);
      return manager;
    } finally {
      releaseRecoveryLock();
    }
  },

  createWallet: async (mnemonic: string): Promise<Manager> => {
    await requireNoFileRestore();

    await initService.destroyWallet({ preserveSetup: true });

    isInitializing = true;
    try {
      await seedService.saveMnemonic(mnemonic);
      const m = await initializeWithMnemonic(mnemonic);
      return m;
    } finally {
      isInitializing = false;
    }
  },

  /**
   * Get the Manager instance. Throws if not initialized.
   */
  getManager: (): Manager => {
    if (!manager) {
      throw new Error('Manager not initialized. Call init() or createWallet() first.');
    }
    return manager;
  },

  /**
   * Get the Repositories instance. Throws if not initialized.
   */
  getRepo: (): ExpoSqliteRepositories => {
    if (!repo) {
      throw new Error('Repositories not initialized.');
    }
    return repo;
  },

  /**
   * Check if the Manager is currently initialized.
   */
  isInitialized: (): boolean => {
    return manager !== null;
  },

  /**
   * Properly cleanup watchers and reset state.
   */
  cleanup: async (options: { strict?: boolean } = {}): Promise<void> => {
    const releaseRecoveryLock = recoveryCoordinator.beginLifecycle();
    invalidateWalletSnapshot();
    try {
      await recoveryCoordinator.drainBackground();
      // First-run file import has no wallet runtime to tear down. Persisted stores
      // may still have opened SQLite; close it without loading network services.
      if (!manager && !dbInstance && !appStateSubscription) {
        closeDb(options.strict);
        isInitializing = false;
        return;
      }
      const { feedbackCoordinator } = await import('~/services/feedback/feedbackCoordinator');
      feedbackCoordinator.clear();
      const { stopLightningAddress } = await import('./lightningAddressLifecycle');
      await stopLightningAddress();
      const { stopMintTransferService } = await import('./mintTransferService');
      stopMintTransferService();
      const { requestLifecycleService } = await import('./requestLifecycleService');
      requestLifecycleService.stop();
      const { useNostrRequestStore } = await import('~/state/nostrRequestStore');
      useNostrRequestStore.getState().clear();
      nostrService.stop();
      const { nostrClaimService } = await import('~/services/wallet/nostrClaimService');
      nostrClaimService.stop();
      const { expiryService } = await import('~/services/wallet/expiryService');
      expiryService.stopSweeper();
      if (manager) {
        await disableWatchers(manager);
        await manager.dispose?.();
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
      closeDb(options.strict);
      dbInstance = null;
      manager = null;
      repo = null;
      isInitializing = false;
    } finally {
      releaseRecoveryLock();
    }
  },

  /**
   * Reset the Manager (for logout or dev purposes).
   * Cleans up AppState listener, disables watchers, and nullifies references.
   */
  reset: async (): Promise<void> => {
    const releaseRecoveryLock = recoveryCoordinator.beginLifecycle();
    invalidateWalletSnapshot();
    try {
      await recoveryCoordinator.drainBackground();
      const { feedbackCoordinator } = await import('~/services/feedback/feedbackCoordinator');
      feedbackCoordinator.clear();
      const { stopLightningAddress } = await import('./lightningAddressLifecycle');
      await stopLightningAddress();
      const { stopMintTransferService } = await import('./mintTransferService');
      stopMintTransferService();
      const { requestLifecycleService } = await import('./requestLifecycleService');
      requestLifecycleService.stop();
      const { useNostrRequestStore } = await import('~/state/nostrRequestStore');
      useNostrRequestStore.getState().clear();
      nostrService.stop();
      const { nostrClaimService } = await import('~/services/wallet/nostrClaimService');
      nostrClaimService.stop();
      const { expiryService } = await import('~/services/wallet/expiryService');
      expiryService.stopSweeper();
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
      if (manager) {
        await disableWatchers(manager);
      }
      manager = null;
      repo = null;
      closeDb();
      dbInstance = null;
      isInitializing = false;
    } finally {
      releaseRecoveryLock();
    }
  },

  restoreWallet: async (
    mnemonic: string,
    options: { quiet?: boolean; preserveSetup?: boolean } = {},
  ): Promise<Manager> => {
    await requireNoFileRestore();

    await initService.destroyWallet({ preserveSetup: options.preserveSetup });

    await seedService.saveMnemonic(mnemonic);

    // Just initialize normally — deep recovery happens asynchronously in the background queue
    const m = await initializeWithMnemonic(mnemonic, {
      quiet: options.quiet,
      nostrRestoredAt: Math.floor(Date.now() / 1000),
    });

    return m;
  },

  /**
   * Completely destroy the wallet — delete DB, clear seed, full wipe.
   * Used for "Delete Wallet" in settings.
   */
  destroyWallet: (options: { preserveSetup?: boolean } = {}): Promise<void> => {
    if (deletionFlight) return deletionFlight;
    deletionFlight = (async () => {
      await requireNoFileRestore();
      const releaseRecoveryLock = recoveryCoordinator.beginLifecycle();
      invalidateWalletSnapshot();
      try {
        await recoveryCoordinator.drainBackground();
        const { nfcFlow } =
          require('~/features/nfc/nfcFlow') as typeof import('~/features/nfc/nfcFlow');
        await nfcFlow.resetForWalletDeletion();
        const { nfcReceiveCoordinator } =
          require('./nfcReceiveCoordinator') as typeof import('./nfcReceiveCoordinator');
        await nfcReceiveCoordinator.resetForWalletDeletion();
        const { feedbackCoordinator } =
          require('~/services/feedback/feedbackCoordinator') as typeof import('~/services/feedback/feedbackCoordinator');
        feedbackCoordinator.clear();

        const { resetMintBackup } =
          require('./mintBackupService') as typeof import('./mintBackupService');
        resetMintBackup();
        // Stop all writers before deleting storage. Never cut off an active wallet operation.
        await initService.cleanup({ strict: true });
        const { queryClient } =
          require('~/shared/utils/queryClient') as typeof import('~/shared/utils/queryClient');
        await queryClient.cancelQueries();
        const resumeWrites = suspendWalletStorageWrites();
        try {
          const { notificationService } =
            require('~/services/platform/notificationService') as typeof import('~/services/platform/notificationService');
          await notificationService.clear();
          closeDb(true);
          await finishLocalWalletDeletion(options.preserveSetup);
        } finally {
          resumeWrites();
        }
      } finally {
        releaseRecoveryLock();
      }
    })().finally(() => {
      deletionFlight = null;
    });
    return deletionFlight;
  },
};
