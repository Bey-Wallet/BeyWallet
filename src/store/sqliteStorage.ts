import * as SQLite from 'expo-sqlite';
import type { StateStorage } from 'zustand/middleware';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Lazy initializer for the shared SQLite database connection.
 * Sets standard performance pragmas and ensures the settings table is present.
 */
export function getDb(): SQLite.SQLiteDatabase {
    if (!dbInstance) {
        dbInstance = SQLite.openDatabaseSync('coco_wallet.db');
        
        // WAL mode permits concurrent reads and writes, avoiding database locks.
        dbInstance.execSync('PRAGMA journal_mode = WAL;');
        dbInstance.execSync('PRAGMA synchronous = NORMAL;');
        // 8 MB page cache in memory
        dbInstance.execSync('PRAGMA cache_size = -8000;');
        // Wait up to 3s before raising SQLITE_BUSY to prevent write contention
        dbInstance.execSync('PRAGMA busy_timeout = 3000;');
        dbInstance.execSync('PRAGMA temp_store = MEMORY;');

        dbInstance.execSync(`
          CREATE TABLE IF NOT EXISTS coco_cashu_settings (
            key   TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
        `);
    }
    return dbInstance;
}

/**
 * Safely closes the shared SQLite database connection.
 */
export function closeDb(): void {
    if (dbInstance) {
        try {
            dbInstance.closeSync();
        } catch (error) {
            console.warn('[SqliteStorage] Failed to close database connection:', error);
        }
        dbInstance = null;
    }
}

/**
 * A fast, synchronous storage driver for Zustand using expo-sqlite.
 * Enables zero-delay hydration on app start by fetching state before the first React render frame.
 */
export const sqliteStorage: StateStorage = {
    getItem: (name: string): string | null => {
        try {
            const db = getDb();
            const row = db.getFirstSync<{ value: string }>(
                'SELECT value FROM coco_cashu_settings WHERE key = ?',
                [name]
            );
            return row ? row.value : null;
        } catch (error) {
            console.warn(`[SqliteStorage] Failed to get item ${name}:`, error);
            return null;
        }
    },
    setItem: (name: string, value: string): void => {
        try {
            const db = getDb();
            db.runSync(
                'INSERT OR REPLACE INTO coco_cashu_settings (key, value) VALUES (?, ?)',
                [name, value]
            );
        } catch (error) {
            console.warn(`[SqliteStorage] Failed to set item ${name}:`, error);
        }
    },
    removeItem: (name: string): void => {
        try {
            const db = getDb();
            db.runSync('DELETE FROM coco_cashu_settings WHERE key = ?', [name]);
        } catch (error) {
            console.warn(`[SqliteStorage] Failed to remove item ${name}:`, error);
        }
    },
};
