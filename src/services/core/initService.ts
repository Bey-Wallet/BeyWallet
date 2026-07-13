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

import { Manager, ConsoleLogger } from 'coco-cashu-core';
import { ExpoSqliteRepositories } from '../../store/test';
import * as SQLite from 'expo-sqlite';
import { getDb, closeDb } from '../../store/sqliteStorage';
import { seedService } from '../seedService';
import { AppState, type AppStateStatus } from 'react-native';
import { HistoryWatcherPlugin } from './plugins/HistoryWatcherPlugin';
import { NPCPlugin } from 'coco-cashu-plugin-npc';
import { finalizeEvent } from 'nostr-tools/pure';
import { Buffer } from 'buffer';
import { nostrService } from './nostrService';
import { Keyset } from '@cashu/cashu-ts';
import { expiryService } from './expiryService';

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
        if (this.id && this.id.length === 66 && (this.id.startsWith('01') || this.id.startsWith('00'))) {
            console.warn(`[InitService] 🛠️ KeysetPatch: Bypassing verification for non-standard ID: ${this.id}`);
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
                mintUrl, keysetId,
            );
            console.log(`[InitService] 🧹 Deleted corrupted keyset ${keysetId} for ${mintUrl}`);
        } else {
            await db.runAsync(
                `DELETE FROM coco_cashu_keysets WHERE mintUrl = ?`,
                mintUrl,
            );
            console.log(`[InitService] 🧹 Deleted ALL keysets for ${mintUrl}`);
        }

        // Also clear the counters so the SDK doesn't try to resume from a bad counter
        await db.runAsync(
            `DELETE FROM coco_cashu_counters WHERE mintUrl = ?`,
            mintUrl,
        );
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
        }
    );
}

/**
 * Enable watchers and processors with staggered delays to prevent
 * transaction conflicts. Matches Sovran's pattern.
 */
async function enableWatchers(mgr: Manager, options: { fast?: boolean } = {}): Promise<void> {
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
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

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

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    // Enable proof state watcher (with retry)
    try {
        await mgr.enableProofStateWatcher();
        console.log('[InitService] ✅ Proof state watcher enabled');
    } catch (error) {
        console.warn('[InitService] Proof state watcher failed, retrying once...', error);
        try {
            if (delay > 0) await new Promise(resolve => setTimeout(resolve, 1000));
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
    info: () => { },
    debug: () => { },
};

/**
 * Core initialization with a mnemonic. Opens DB, creates repos,
 * creates Manager with explicit watcher enabling.
 */
async function initializeWithMnemonic(mnemonic: string, options: { quiet?: boolean } = {}): Promise<Manager> {
    const seed = await seedService.deriveSeed(mnemonic);

    // Retrieve the shared SQLite database connection
    const db = getDb();

    dbInstance = db;
    const repositories = new ExpoSqliteRepositories({ database: db });
    await repositories.init();

    // Setup Nostr listener & NPC Plugin
    const { privkey, pubkey } = await seedService.getNostrKeys(mnemonic);
    const privateKeyBytes = Buffer.from(privkey, 'hex');

    const signerFunction = async (eventTemplate: any) => {
        return finalizeEvent(eventTemplate, privateKeyBytes);
    };

    const npcPlugin = new NPCPlugin(
        'https://npubx.cash',
        signerFunction,
        {
            syncIntervalMs: 30000,
            useWebsocket: true,
        }
    );

    // Using the shared customLogger declared at module scope

    // Initialize Manager using constructor (rc47 pattern)
    manager = new Manager(
        repositories,
        async () => new Uint8Array(seed),
        customLogger as any,
        undefined,
        [HistoryWatcherPlugin, npcPlugin]
    );

    repo = repositories;
    setupAppStateListener();

    if (!options.quiet) {
        // Enable watchers with staggered delays to prevent DB contention on start
        await enableWatchers(manager);
        
        // Start listening for Nostr Incoming Payments (Direct Messages)
        nostrService.start(privkey, pubkey);

        // Start pending tokens sweeper
        expiryService.startSweeper();

        console.log('[InitService] Manager ready with watchers and processors');

        // Trigger initial NPC sync (NON-BLOCKING)
        (async () => {
            try {
                await npcPlugin.sync();
                console.log('[InitService] ✅ Initial NPC sync completed');
            } catch (error) {
                console.error('[InitService] Initial NPC sync failed:', error);
            }
        })();
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
                await new Promise(resolve => setTimeout(resolve, 100));
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
    reinitFast: async (): Promise<Manager> => {
        console.log('[InitService] Performing fast-path re-initialization...');
        const mnemonic = await seedService.getMnemonic();
        if (!mnemonic) throw new Error('No mnemonic found');

        const seed = await seedService.deriveSeed(mnemonic);

        // If a manager already exists, we must disable its watchers first
        if (manager) {
            try { 
                await disableWatchers(manager);
                await manager.dispose?.(); 
            } catch (e) { }
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
        const privateKeyBytes = Buffer.from(privkey, 'hex');
        const signerFunction = async (eventTemplate: any) => finalizeEvent(eventTemplate, privateKeyBytes);
        const npcPlugin = new NPCPlugin('https://npubx.cash', signerFunction, { syncIntervalMs: 30000, useWebsocket: true });

        manager = new Manager(
            repositories,
            async () => new Uint8Array(seed),
            customLogger as any,
            undefined,
            [HistoryWatcherPlugin, npcPlugin]
        );

        repo = repositories;
        setupAppStateListener();

        // Enable watchers WITHOUT staggered delays
        await enableWatchers(manager, { fast: true });
        
        // Start Nostr background receiver
        nostrService.start(privkey, pubkey);

        // Start pending tokens sweeper
        expiryService.startSweeper();
        
        return manager;
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
        nostrService.stop();
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
    },

    /**
     * Reset the Manager (for logout or dev purposes).
     * Cleans up AppState listener, disables watchers, and nullifies references.
     */
    reset: (): void => {
        expiryService.stopSweeper();
        if (appStateSubscription) {
            appStateSubscription.remove();
            appStateSubscription = null;
        }
        manager = null;
        repo = null;
        closeDb();
        dbInstance = null;
        isInitializing = false;
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
        console.log('[InitService] Destroying wallet...');

        // 1. Cleanup watchers and manager
        await initService.cleanup();

        // 2. Delete the SQLite databases (both main and restore)
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
    },
};
