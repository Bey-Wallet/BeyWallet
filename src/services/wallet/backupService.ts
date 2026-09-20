import { initService } from '~/services/wallet';

export interface WalletState {
  mints: any[];
  keysets: any[];
  proofs: any[];
  counters: any[];
  history: any[];
  mintQuotes: any[];
  meltOperations: any[];
  sendOperations: any[];
}

export const backupService = {
  /**
   * Export the full internal state of the wallet.
   * Fetches mints, keysets, proofs, counters, history, and pending quotes.
   */
  exportState: async (): Promise<WalletState> => {
    const repo = initService.getRepo();
    const db = (repo as any).db;

    console.log('[BackupService] Exporting full wallet state...');

    // 1. Fetch all mints
    const mints = await db.all('SELECT * FROM coco_cashu_mints');

    // 2. Fetch all keysets
    const keysets = await db.all('SELECT * FROM coco_cashu_keysets');

    // 3. Fetch all proofs (ready and inflight)
    const proofs = await db.all('SELECT * FROM coco_cashu_proofs');

    // 4. Fetch all counters
    const counters = await db.all('SELECT * FROM coco_cashu_counters');

    // 5. Fetch all history entries
    const history = await db.all('SELECT * FROM coco_cashu_history');

    // 6. Fetch all mint quotes (not just pending)
    const mintQuotes = await db.all('SELECT * FROM coco_cashu_mint_quotes');

    // 7. Fetch send/melt operations (for pending status recovery)
    const sendOperations = await db.all('SELECT * FROM coco_cashu_send_operations');
    const meltOperations = await db.all('SELECT * FROM coco_cashu_melt_operations');

    console.log(
      `[BackupService] Export complete: ${proofs.length} proofs, ${mints.length} mints, ${history.length} history items.`,
    );

    return {
      mints,
      keysets,
      proofs,
      counters,
      history,
      mintQuotes,
      sendOperations,
      meltOperations,
    };
  },

  /**
   * Import a full state into the database.
   * Overwrites or merges depending on the table.
   */
  importState: async (state: WalletState): Promise<void> => {
    const repo = initService.getRepo();
    const db = (repo as any).db;

    console.log('[BackupService] Importing wallet state...');

    try {
      await db.transaction(async (tx: any) => {
        // 1. Restore mints
        // Handle legacy format where 'url' was used instead of 'mintUrl'
        for (const m of state.mints || []) {
          const normalized = { ...m };
          if ('url' in normalized && !('mintUrl' in normalized)) {
            normalized.mintUrl = normalized.url;
            delete (normalized as any).url;
          }

          // Safety: Ensure required fields for coco_cashu_mints
          if (!normalized.mintUrl) continue;
          if (!normalized.name) normalized.name = 'Restored Mint';
          if (!normalized.mintInfo) normalized.mintInfo = '{}';
          if (normalized.createdAt === undefined)
            normalized.createdAt = Math.floor(Date.now() / 1000);
          if (normalized.updatedAt === undefined)
            normalized.updatedAt = Math.floor(Date.now() / 1000);
          if (normalized.trusted === undefined) normalized.trusted = 1;

          const keys = Object.keys(normalized).join(', ');
          const placeholders = Object.keys(normalized)
            .map(() => '?')
            .join(', ');
          const values = Object.values(normalized);
          await tx.run(
            `INSERT OR REPLACE INTO coco_cashu_mints (${keys}) VALUES (${placeholders})`,
            values,
          );
        }

        // 2. Restore keysets
        for (const k of state.keysets || []) {
          if (!k.mintUrl || !k.id) continue;
          const keys = Object.keys(k).join(', ');
          const placeholders = Object.keys(k)
            .map(() => '?')
            .join(', ');
          const values = Object.values(k);
          await tx.run(
            `INSERT OR REPLACE INTO coco_cashu_keysets (${keys}) VALUES (${placeholders})`,
            values,
          );
        }

        // 3. Restore proofs
        for (const p of state.proofs || []) {
          if (!p.mintUrl || !p.secret) continue;
          const keys = Object.keys(p).join(', ');
          const placeholders = Object.keys(p)
            .map(() => '?')
            .join(', ');
          const values = Object.values(p);
          await tx.run(
            `INSERT OR IGNORE INTO coco_cashu_proofs (${keys}) VALUES (${placeholders})`,
            values,
          );
        }

        // 4. Restore counters
        for (const c of state.counters || []) {
          if (!c.mintUrl || !c.keysetId) continue;
          await tx.run(
            `INSERT INTO coco_cashu_counters (mintUrl, keysetId, counter)
                         VALUES (?, ?, ?)
                         ON CONFLICT(mintUrl, keysetId) DO UPDATE SET
                         counter = MAX(coco_cashu_counters.counter, excluded.counter)`,
            [c.mintUrl, c.keysetId, c.counter],
          );
        }

        // 5. Restore history
        for (const h of state.history || []) {
          const { id, ...rest } = h;
          if (!rest.mintUrl) continue;

          const keys = Object.keys(rest).join(', ');
          const placeholders = Object.keys(rest)
            .map(() => '?')
            .join(', ');
          const values = Object.values(rest);

          let exists = false;
          if (rest.operationId) {
            const row = await tx.get(
              'SELECT 1 FROM coco_cashu_history WHERE operationId = ? AND type = ?',
              [rest.operationId, rest.type],
            );
            if (row) exists = true;
          } else if (rest.quoteId) {
            const row = await tx.get(
              'SELECT 1 FROM coco_cashu_history WHERE quoteId = ? AND type = ?',
              [rest.quoteId, rest.type],
            );
            if (row) exists = true;
          }

          if (!exists) {
            await tx.run(
              `INSERT INTO coco_cashu_history (${keys}) VALUES (${placeholders})`,
              values,
            );
          }
        }

        // 6. Restore mint quotes
        for (const q of state.mintQuotes || []) {
          if (!q.mintUrl || !q.quote) continue;
          const keys = Object.keys(q).join(', ');
          const placeholders = Object.keys(q)
            .map(() => '?')
            .join(', ');
          const values = Object.values(q);
          await tx.run(
            `INSERT OR IGNORE INTO coco_cashu_mint_quotes (${keys}) VALUES (${placeholders})`,
            values,
          );
        }

        // 7. Restore send operations
        for (const op of state.sendOperations || []) {
          if (!op.id) continue;
          const keys = Object.keys(op).join(', ');
          const placeholders = Object.keys(op)
            .map(() => '?')
            .join(', ');
          const values = Object.values(op);
          await tx.run(
            `INSERT OR IGNORE INTO coco_cashu_send_operations (${keys}) VALUES (${placeholders})`,
            values,
          );
        }

        // 8. Restore melt operations
        for (const op of state.meltOperations || []) {
          if (!op.id) continue;
          const keys = Object.keys(op).join(', ');
          const placeholders = Object.keys(op)
            .map(() => '?')
            .join(', ');
          const values = Object.values(op);
          await tx.run(
            `INSERT OR IGNORE INTO coco_cashu_melt_operations (${keys}) VALUES (${placeholders})`,
            values,
          );
        }
      });
      console.log('[BackupService] ✅ Import successful.');
    } catch (err: any) {
      console.error('[BackupService] Import failed:', err);
      // If the error is "database is locked", we might want to retry or at least not crash everything
      if (err.message?.includes('database is locked')) {
        throw new Error('Database is busy. Please try again in a moment.');
      }
      throw err;
    }
  },
};
