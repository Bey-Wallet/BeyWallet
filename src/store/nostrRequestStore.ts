/**
 * NostrRequestStore
 *
 * Persists NUT-18 Cashu Payment Requests (creqA strings) to SQLite so
 * they appear in the E-Cash pending list as soon as the user generates
 * them, and can be updated to 'received' when ecash lands via Nostr.
 *
 * Uses expo-sqlite directly (bypasses Coco SDK) since this is our own
 * application-level table (migration 015).
 */

import { create } from 'zustand';
import * as SQLite from 'expo-sqlite';

// ─── Types ────────────────────────────────────────────────────────────────

export type NostrRequestState = 'pending' | 'received' | 'expired' | 'cancelled';

export interface NostrReceiveRequest {
  id: string;
  mintUrl: string;
  amount: number;
  unit: string;
  creqString: string;
  nostrPubkey: string;
  description?: string;
  state: NostrRequestState;
  createdAt: number;
  updatedAt: number;
}

interface NostrRequestStoreState {
  pendingRequests: NostrReceiveRequest[];

  // Actions
  addRequest: (req: Omit<NostrReceiveRequest, 'state' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  markReceived: (id: string) => Promise<void>;
  markCancelled: (id: string) => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  clearExpiredRequests: (olderThanMs?: number) => Promise<void>;
}

// ─── DB Helpers ───────────────────────────────────────────────────────────

const TABLE = 'coco_cashu_nostr_receive_requests';

/**
 * Lazy getter — reuses the single shared db connection opened by initService.
 * We use require() inside the function (not a top-level import) to avoid the
 * circular dependency: initService → nostrService → nostrRequestStore → initService.
 */
function getDb(): SQLite.SQLiteDatabase {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSharedDb } = require('../services/core/initService') as { getSharedDb: () => SQLite.SQLiteDatabase | null };
    const shared = getSharedDb();
    if (shared) return shared;
  } catch {
    // initService not yet loaded — fall through to own connection
  }
  // Use the shared getDb from sqliteStorage to avoid multi-connection deadlocks
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDb: getSqliteDb } = require('./sqliteStorage') as { getDb: () => SQLite.SQLiteDatabase };
  return getSqliteDb();
}


function rowToRequest(row: any): NostrReceiveRequest {
  return {
    id: row.id,
    mintUrl: row.mintUrl,
    amount: row.amount,
    unit: row.unit ?? 'sat',
    creqString: row.creqString,
    nostrPubkey: row.nostrPubkey,
    description: row.description ?? undefined,
    state: row.state as NostrRequestState,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useNostrRequestStore = create<NostrRequestStoreState>((set, get) => ({
  pendingRequests: [],

  addRequest: async (req) => {
    const now = Date.now();
    const db = getDb();

    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE}
           (id, mintUrl, amount, unit, creqString, nostrPubkey, description, state, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        req.id,
        req.mintUrl,
        req.amount,
        req.unit ?? 'sat',
        req.creqString,
        req.nostrPubkey,
        req.description ?? null,
        now,
        now,
      );

      const newRequest: NostrReceiveRequest = {
        ...req,
        unit: req.unit ?? 'sat',
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      set(s => {
          // Deduplicate in-memory — DB handles it via INSERT OR REPLACE,
          // but the Zustand state also needs to avoid duplicates.
          if (s.pendingRequests.some(existing => existing.id === req.id)) {
              return s;
          }
          return { pendingRequests: [newRequest, ...s.pendingRequests] };
      });
      console.log(`[NostrRequestStore] Request saved: ${req.id} (${req.amount} sats)`);
    } catch (err) {
      console.error('[NostrRequestStore] Failed to save request:', err);
    }
  },

  markReceived: async (id: string) => {
    const now = Date.now();
    const db = getDb();

    try {
      await db.runAsync(
        `UPDATE ${TABLE} SET state = 'received', updatedAt = ? WHERE id = ?`,
        now,
        id,
      );

      set(s => ({
        pendingRequests: s.pendingRequests.map(r =>
          r.id === id ? { ...r, state: 'received' as NostrRequestState, updatedAt: now } : r,
        ),
      }));
      console.log(`[NostrRequestStore] Request marked received: ${id}`);
    } catch (err) {
      console.error('[NostrRequestStore] Failed to mark received:', err);
    }
  },

  markCancelled: async (id: string) => {
    const now = Date.now();
    const db = getDb();

    try {
      await db.runAsync(
        `UPDATE ${TABLE} SET state = 'cancelled', updatedAt = ? WHERE id = ?`,
        now,
        id,
      );

      set(s => ({
        pendingRequests: s.pendingRequests.filter(r => r.id !== id),
      }));
    } catch (err) {
      console.error('[NostrRequestStore] Failed to cancel request:', err);
    }
  },

  loadPendingRequests: async () => {
    const db = getDb();

    try {
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM ${TABLE} WHERE state = 'pending' ORDER BY createdAt DESC LIMIT 100`,
      );
      set({ pendingRequests: rows.map(rowToRequest) });
      console.log(`[NostrRequestStore] Loaded ${rows.length} pending requests`);
    } catch (err) {
      // Table may not exist yet (first load before migration runs) — safe to ignore
      console.warn('[NostrRequestStore] Could not load pending requests (table may not exist yet):', err);
      set({ pendingRequests: [] });
    }
  },

  clearExpiredRequests: async (olderThanMs = 24 * 60 * 60 * 1000) => {
    const cutoff = Date.now() - olderThanMs;
    const db = getDb();

    try {
      await db.runAsync(
        `UPDATE ${TABLE} SET state = 'expired', updatedAt = ? WHERE state = 'pending' AND createdAt < ?`,
        Date.now(),
        cutoff,
      );
      // Re-load after expiry sweep
      await get().loadPendingRequests();
    } catch (err) {
      console.warn('[NostrRequestStore] clearExpiredRequests failed:', err);
    }
  },
}));

// ─── Singleton helpers (for use outside React) ────────────────────────────

export const nostrRequestStore = {
  /**
   * Mark a request as received. Called from NostrService when ecash lands.
   * Uses the store's state setter directly (works outside React).
   */
  markReceived: (id: string): Promise<void> => {
    return useNostrRequestStore.getState().markReceived(id);
  },

  /**
   * Get all pending requests (for NostrService to reference when matching claims).
   */
  getPending: (): NostrReceiveRequest[] => {
    return useNostrRequestStore.getState().pendingRequests;
  },
};
