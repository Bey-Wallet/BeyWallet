/**
 * History service — paginated transaction history.
 *
 * Uses Manager.history (HistoryApi).
 */

import { initService } from './initService';
import type { HistoryEntry } from 'coco-cashu-core';

export const historyService = {
    /**
     * Get paginated transaction history entries.
     *
     * @param limit - Number of entries to return (default: 25)
     * @param offset - Pagination offset (default: 0)
     * @returns Array of HistoryEntry (MintHistoryEntry | MeltHistoryEntry | SendHistoryEntry | ReceiveHistoryEntry)
     */
    getHistory: async (limit = 25, offset = 0): Promise<HistoryEntry[]> => {
        return initService.getManager().history.getPaginatedHistory(offset, limit);
    },
    /**
     * Delete multiple history entries by their IDs.
     * @param ids - Array of history entry IDs
     */
    deleteHistoryEntries: async (ids: string[]): Promise<void> => {
        return initService.getRepo().historyRepository.deleteHistoryEntriesByIds(ids);
    },

    /**
     * Stamp "via" metadata onto a history entry right after it's written.
     *
     * Because coco-cashu-core writes history entries internally (we can't intercept),
     * we UPDATE the metadata column on the most-recently created matching entry.
     *
     * @param mintUrl    - Mint URL used in the transaction
     * @param type       - 'send' | 'receive' | 'mint' | 'melt'
     * @param via        - Channel: 'qr' | 'nfc' | 'nostr' | 'lightning'
     * @param extra      - Extra fields merged into metadata (e.g. nostrUsername, nostrPubkey)
     * @param operationId - Optional operationId to target a specific row
     */
    tagHistoryVia: async (
        mintUrl: string,
        type: 'send' | 'receive' | 'mint' | 'melt',
        via: string,
        extra?: Record<string, any>,
        operationId?: string,
    ): Promise<void> => {
        try {
            const normalized = mintUrl.trim().replace(/\/+$/, '');
            const withSlash = normalized + '/';
            const repo = initService.getRepo();
            // Access raw ExpoSqliteDb wrapper — same pattern used by proofService
            const db = (repo.historyRepository as any).db as {
                get: (sql: string, params?: any[]) => Promise<any>;
                run: (sql: string, params?: any[]) => Promise<any>;
            };
            if (!db?.run) return;

            // Fetch the current metadata on the target row
            let row: any;
            if (operationId) {
                row = await db.get(
                    `SELECT id, metadata FROM coco_cashu_history
                     WHERE (mintUrl = ? OR mintUrl = ?) AND type = ? AND operationId = ?
                     ORDER BY createdAt DESC LIMIT 1`,
                    [normalized, withSlash, type, operationId],
                );
            } else {
                row = await db.get(
                    `SELECT id, metadata FROM coco_cashu_history
                     WHERE (mintUrl = ? OR mintUrl = ?) AND type = ?
                     ORDER BY createdAt DESC LIMIT 1`,
                    [normalized, withSlash, type],
                );
            }
            if (!row) {
                console.warn('[HistoryService] tagHistoryVia: target history row not found for mint:', normalized);
                return;
            }

            // Merge new via info with any pre-existing metadata
            const existing = row.metadata ? JSON.parse(row.metadata) : {};
            const updated = JSON.stringify({ ...existing, via, ...extra });
            await db.run(
                `UPDATE coco_cashu_history SET metadata = ? WHERE id = ?`,
                [updated, row.id],
            );
        } catch (err) {
            // Non-critical — never crash the app for a metadata tag
            console.warn('[HistoryService] tagHistoryVia failed:', err);
        }
    },
};

