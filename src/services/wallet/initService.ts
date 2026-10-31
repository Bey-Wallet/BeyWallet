import { invalidateWalletSnapshot } from '~/storage/sqlite/sqliteStorage';
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
import { seedService } from '~/services/platform/seedService';
import { AppState, type AppStateStatus } from 'react-native';
import { HistoryWatcherPlugin } from '~/services/wallet/plugins/HistoryWatcherPlugin';
import { OfflineChangePlugin } from '~/services/wallet/plugins/OfflineChangePlugin';
import { LocalSendEventsPlugin } from '~/services/wallet/plugins/LocalSendEventsPlugin';
import { ChangePreparationPlugin } from '~/services/wallet/plugins/ChangePreparationPlugin';
import { nostrService } from '~/services/wallet/nostrService';
import { Keyset } from '@cashu/cashu-ts';

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
      console.warn(
        `[InitService] 🛠️ KeysetPatch: Bypassing verification for non-standard ID: ${this.id}`,
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
    console.warn('[InitService] purgeCorruptedKeysets: db not ready, skipping');
    return;
  }

  try {
    if (keysetId) {
      await db.runAsync(
        `DELETE FROM coco_cashu_keysets WHERE mintUrl = ? AND id = ?`,
        mintUrl,
        keysetId,
      );
      console.log(`[InitService] 🧹 Deleted corrupted keyset ${keysetId} for ${mintUrl}`);
    } else {
      await db.runAsync(`DELETE FROM coco_cashu_keysets WHERE mintUrl = ?`, mintUrl);
      console.log(`[InitService] 🧹 Deleted ALL keysets for ${mintUrl}`);
    }

    // Also clear the counters so the SDK doesn't try to resume from a bad counter
    await db.runAsync(`DELETE FROM coco_cashu_counters WHERE mintUrl = ?`, mintUrl);
    console.log(`[InitService] 🧹 Cleared counters for ${mintUrl}`);
  } catch (err) {
    console.warn('[InitService] purgeCorruptedKeysets failed:', err);
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
          console.log('[InitService] App → background, pausing subscriptions');
          await manager.pauseSubscriptions();
        } else if (nextAppState === 'active') {
          console.log('[InitService] App → foreground, resuming subscriptions');
          await manager.resumeSubscriptions();
        }
      } catch (err) {
        console.error('[InitService] Subscription lifecycle error:', err);
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
    console.log('[InitService] ✅ Mint quote watcher enabled');
  } catch (error) {
    console.warn('[InitService] Mint quote watcher failed:', error);
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
    console.log('[InitService] ✅ Mint quote processor enabled');
  } catch (error) {
    console.warn('[InitService] Mint quote processor failed:', error);
  }

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  // Enable proof state watcher (with retry)
  try {
    await mgr.enableProofStateWatcher();
    console.log('[InitService] ✅ Proof state watcher enabled');
  } catch (error) {
    console.warn('[InitService] Proof state watcher failed, retrying once...', error);
    try {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      await mgr.enableProofStateWatcher();
      console.log('[InitService] ✅ Proof state watcher enabled on retry');
    } catch (retryError) {
      console.error('[InitService] Proof state watcher failed on retry:', retryError);
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
    console.warn('[InitService] Failed to disable proof state watcher:', e);
  }
  try {
    await mgr.disableMintQuoteProcessor();
  } catch (e) {
    console.warn('[InitService] Failed to disable mint quote processor:', e);
  }
  try {
    await mgr.disableMintQuoteWatcher();
  } catch (e) {
    console.warn('[InitService] Failed to disable mint quote watcher:', e);
  }
}

// Custom logger to suppress expected keyset/WS/polling errors that are handled gracefully by the SDK/wallet wrappers
const customLogger = {
  error: (msg: string, ...meta: any[]) => {
    if (
      msg.includes('Keyset restore failed') ||
      msg.includes('Restore completed with failures') ||
      msg === 'WS error' ||
      msg.includes('WS request error') ||
      msg.includes('Polling task error') ||
      msg.includes('Failed to process mint quote') ||
      msg.includes('Failed to redeem mint quote') ||
      msg.includes('had undefined amount') ||
      msg.includes('Quote amount undefined')
    ) {
      // Suppress noisy expected background/network errors
      return;
    }
    if (msg.includes('Failed to fetch mint info')) {
      const mintUrl = meta[0]?.mintUrl;
      console.warn(`[Coco] Mint unavailable while refreshing info${mintUrl ? `: ${mintUrl}` : ''}`);
      return;
    }
    console.error(`[Coco] ${msg}`, ...meta);
  },
  warn: (msg: string, ...meta: any[]) => {
    if (
      msg.includes('WS request error') ||
      msg.includes('Polling task error') ||
      msg.includes('had undefined amount') ||
      msg.includes('Quote amount undefined') ||
      msg.includes('Failed to process mint quote') ||
      msg.includes('Failed to redeem mint quote')
    ) {
      // Suppress noisy expected background/network warnings
      return;
    }
    console.warn(`[Coco] ${msg}`, ...meta);
  },
  info: () => {},
  debug: () => {},
};

/**
 * Core initialization with a mnemonic. Opens DB, creates repos,
 * creates Manager with explicit watcher enabling.
 */
async function initializeWithMnemonic(
  mnemonic: string,
  options: { quiet?: boolean } = {},
): Promise<Manager> {
  const seed = await seedService.deriveSeed(mnemonic);

  // Retrieve the shared SQLite database connection
  const db = getDb();

  dbInstance = db;
  const repositories = new ExpoSqliteRepositories({ database: db });
  await repositories.init();

  // Reuse the existing seed-derived Nostr identity for both receiving protocols.
  const { privkey, pubkey } = await seedService.getNostrKeys(mnemonic);
  const { prepareRecoverySession } = await import('~/state/recoverySessionStore');
  await prepareRecoverySession(pubkey);
  const { FeedbackRepository } = await import('~/storage/sqlite/repositories/FeedbackRepository');
  const { feedbackCoordinator } = await import('~/services/feedback/feedbackCoordinator');
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
    [OfflineChangePlugin, LocalSendEventsPlugin, ChangePreparationPlugin, HistoryWatcherPlugin],
  );

  repo = repositories;
  // Hydrate privacy/authentication settings and the identity cache before
  // network watchers. A slow/offline mint must not gate the first Home paint.
  const { useSettingsStore } = await import('~/state/settingsStore');
  await useSettingsStore.getState().initialize(true);
  setupAppStateListener();

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
    void getChangePreparation()
      .recoverPending()
      .catch(() => {});

    // Start pending tokens sweeper
    const { expiryService } = await import('~/services/wallet/expiryService');
    expiryService.startSweeper();

    console.log('[InitService] Manager ready with watchers and processors');

    const { startLightningAddress } = await import('./lightningAddressLifecycle');
    await startLightningAddress(repositories, privkey, pubkey);
  } else {
    console.log('[InitService] Manager ready (quiet mode)');
  }

  return manager;
}

// ─── Public API ───────────────────────────────────────────────

export const initService = {
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
      console.log('[InitService] Already initialized');
      return manager;
    }

    if (isInitializing) {
      console.log('[InitService] Initialization in progress, waiting...');
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
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) {
        throw new Error('No wallet exists. Use createWallet() first.');
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
      console.log('[InitService] Performing fast-path re-initialization...');
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

      const { privkey, pubkey } = await seedService.getNostrKeys(mnemonic);
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
      void getChangePreparation()
        .recoverPending()
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
    console.log('[InitService] Creating new wallet, destroying existing wallet first...');
    await initService.destroyWallet();

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
  cleanup: async (): Promise<void> => {
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
      if (manager) {
        await disableWatchers(manager);
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
      closeDb();
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

  restoreWallet: async (mnemonic: string, options: { quiet?: boolean } = {}): Promise<Manager> => {
    console.log('[InitService] Restoring wallet, destroying existing wallet first...');
    await initService.destroyWallet();

    await seedService.saveMnemonic(mnemonic);

    // Just initialize normally — deep recovery happens asynchronously in the background queue
    const m = await initializeWithMnemonic(mnemonic, options);

    console.log(`[InitService] ✅ Wallet initialized (quiet=${options.quiet})`);
    return m;
  },

  /**
   * Completely destroy the wallet — delete DB, clear seed, full wipe.
   * Used for "Delete Wallet" in settings.
   */
  destroyWallet: async (): Promise<void> => {
    const releaseRecoveryLock = recoveryCoordinator.beginLifecycle();
    invalidateWalletSnapshot();
    try {
      await recoveryCoordinator.drainBackground();
      const { feedbackCoordinator } = await import('~/services/feedback/feedbackCoordinator');
      feedbackCoordinator.clear();
      const { notificationService } = await import('~/services/platform/notificationService');
      await notificationService.clear();
      const { useSettingsStore, notificationDefaults } = await import('~/state/settingsStore');
      useSettingsStore.setState({
        notificationPreferences: { ...notificationDefaults },
        notificationsEnabled: true,
        seedBackedUp: false,
        hideMintConnectionDisclaimer: false,
      });
      console.log('[InitService] Destroying wallet...');
      const { resetMintBackup } =
        require('./mintBackupService') as typeof import('./mintBackupService');
      const { useMintBackupStore, mintBackupDefaults } =
        require('~/state/mintBackupStore') as typeof import('~/state/mintBackupStore');
      resetMintBackup();
      useMintBackupStore.setState({ ...mintBackupDefaults, publishing: false });
      const { useBackupStatusStore, backupStatusDefaults } =
        require('~/state/backupStatusStore') as typeof import('~/state/backupStatusStore');
      useBackupStatusStore.setState({ ...backupStatusDefaults });

      // These account-scoped stores must not carry acceptance or messages into
      // the next wallet in the same process. Clear while storage is still open.
      const { usePeopleStore } =
        require('~/state/peopleStore') as typeof import('~/state/peopleStore');
      const { useNostrInboxStore } =
        require('~/state/nostrInboxStore') as typeof import('~/state/nostrInboxStore');
      const { useNostrReceiveSettingsStore } =
        require('~/state/nostrReceiveSettingsStore') as typeof import('~/state/nostrReceiveSettingsStore');
      usePeopleStore.setState({ people: {} });
      useNostrInboxStore.setState({ items: [], activeClaimId: null });
      useNostrReceiveSettingsStore.setState({ policy: 'ask' });
      const { useRecoverySessionStore, releaseRecoveryPause } =
        await import('~/state/recoverySessionStore');
      useRecoverySessionStore.setState({ session: null });
      releaseRecoveryPause();

      const { useWalletStore } =
        require('~/state/walletStore') as typeof import('~/state/walletStore');
      useWalletStore.setState({
        isRestoring: false,
        restoreQueue: [],
        mintRestoreStatuses: [],
        restoringMintUrl: null,
        restoringMintKeysetProgress: null,
      });

      // 1. Cleanup watchers and manager after account-scoped store writes.
      await initService.cleanup();

      // 2. Delete the SQLite databases (both main and restore)
      const { useNostrRelayStore } =
        require('~/state/nostrRelayStore') as typeof import('~/state/nostrRelayStore');
      useNostrRelayStore.getState().resetRelays();
      try {
        await SQLite.deleteDatabaseAsync('coco_wallet.db');
        console.log('[InitService] Main database deleted');
      } catch (e) {
        console.warn('[InitService] DB delete error (may not exist):', e);
      }
      try {
        await SQLite.deleteDatabaseAsync('cashu_wallet_restore.db');
        console.log('[InitService] Restore database deleted');
      } catch (e) {
        console.warn('[InitService] Restore DB delete error (may not exist):', e);
      }

      // 3. Clear the seed from secure storage
      await seedService.clearWallet();
      console.log('[InitService] Seed cleared');

      console.log('[InitService] Wallet destroyed');
    } finally {
      releaseRecoveryLock();
    }
  },
};
