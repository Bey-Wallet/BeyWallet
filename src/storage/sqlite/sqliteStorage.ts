import * as SQLite from 'expo-sqlite';
import type { StateStorage } from 'zustand/middleware';
import { invalidateWalletStorageGeneration } from './walletStorageLifecycle';
import {
  openEncryptedDatabase,
  prepareRecoveryDatabaseEncryption,
  walletDatabaseNames,
} from './encryptedDatabase';
import { appLogger } from '~/shared/utils/appLogger';

type SynchronousStateStorage = Omit<StateStorage, 'getItem' | 'setItem' | 'removeItem'> & {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

let dbInstance: SQLite.SQLiteDatabase | null = null;
// Only wallet-storage is cached: progress updates repeatedly serialize the same snapshot.
let lastWalletSnapshot: string | undefined;
let suspendedWrites = 0;
/** Reset persisted stores in memory without recreating the database being deleted. */
export function suspendWalletStorageWrites(): () => void {
  suspendedWrites++;
  invalidateWalletStorageGeneration();
  invalidateWalletSnapshot();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspendedWrites--;
    invalidateWalletStorageGeneration();
  };
}
export function invalidateWalletSnapshot(): void {
  lastWalletSnapshot = undefined;
}

/**
 * Lazy initializer for the shared SQLite database connection.
 * Sets standard performance pragmas and ensures the settings table is present.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    const database = openEncryptedDatabase(walletDatabaseNames.active);
    try {
      prepareRecoveryDatabaseEncryption();

      // WAL mode permits concurrent reads and writes, avoiding database locks.
      database.execSync('PRAGMA journal_mode = WAL;');
      database.execSync('PRAGMA synchronous = NORMAL;');
      // 8 MB page cache in memory
      database.execSync('PRAGMA cache_size = -8000;');
      // Wait up to 3s before raising SQLITE_BUSY to prevent write contention
      database.execSync('PRAGMA busy_timeout = 3000;');
      database.execSync('PRAGMA temp_store = MEMORY;');

      database.execSync(`
          CREATE TABLE IF NOT EXISTS coco_cashu_settings (
            key   TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
        `);
      dbInstance = database;
    } catch (error) {
      database.closeSync();
      throw error;
    }
  }
  return dbInstance;
}

/**
 * Safely closes the shared SQLite database connection.
 */
export function closeDb(strict = false): void {
  invalidateWalletSnapshot();
  if (dbInstance) {
    try {
      dbInstance.closeSync();
    } catch (error) {
      if (strict) throw new Error('Wallet database could not be closed safely.');
      appLogger.warn('[SqliteStorage] Failed to close database connection:', error, 'app_runtime');
    }
    dbInstance = null;
  }
}

/**
 * A fast, synchronous storage driver for Zustand using expo-sqlite.
 * Enables zero-delay hydration on app start by fetching state before the first React render frame.
 */
export const sqliteStorage: SynchronousStateStorage = {
  getItem: (name: string): string | null => {
    try {
      const db = getDb();
      const row = db.getFirstSync<{ value: string }>(
        'SELECT value FROM coco_cashu_settings WHERE key = ?',
        [name],
      );
      if (name === 'wallet-storage') lastWalletSnapshot = row?.value;
      return row ? row.value : null;
    } catch (error) {
      appLogger.warn('[SqliteStorage] Failed to get item …:', error, 'app_runtime');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (suspendedWrites) return;
    try {
      const db = getDb();
      if (name === 'wallet-storage' && lastWalletSnapshot === value) return;
      db.runSync('INSERT OR REPLACE INTO coco_cashu_settings (key, value) VALUES (?, ?)', [
        name,
        value,
      ]);
      if (name === 'wallet-storage') lastWalletSnapshot = value;
    } catch (error) {
      if (name === 'wallet-storage') invalidateWalletSnapshot();
      appLogger.warn('[SqliteStorage] Failed to set item …:', error, 'app_runtime');
      if (name === 'wallet-storage') throw error;
    }
  },
  removeItem: (name: string): void => {
    if (suspendedWrites) return;
    if (name === 'wallet-storage') invalidateWalletSnapshot();
    try {
      const db = getDb();
      db.runSync('DELETE FROM coco_cashu_settings WHERE key = ?', [name]);
    } catch (error) {
      appLogger.warn('[SqliteStorage] Failed to remove item …:', error, 'app_runtime');
    }
  },
};
