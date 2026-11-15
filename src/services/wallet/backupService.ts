import { ExpoSqliteDb } from '~/storage/sqlite/db';
import { parseChangeOperation } from '~/storage/sqlite/repositories/ChangeOperationRepository';
import type { WalletState } from './walletBackup';
export type { WalletState } from './walletBackup';

const tables = {
  mints: 'coco_cashu_mints',
  keysets: 'coco_cashu_keysets',
  proofs: 'coco_cashu_proofs',
  counters: 'coco_cashu_counters',
  history: 'coco_cashu_history',
  mintQuotes: 'coco_cashu_mint_quotes',
  sendOperations: 'coco_cashu_send_operations',
  meltOperations: 'coco_cashu_melt_operations',
  changeOperations: 'bey_change_operations',
  meltQuotes: 'coco_cashu_melt_quotes',
  keypairs: 'coco_cashu_keypairs',
} as const;

async function activeDb(): Promise<ExpoSqliteDb> {
  const { initService } = require('./initService') as typeof import('./initService');
  return initService.getRepo().db;
}

export const backupService = {
  exportState: async (database?: ExpoSqliteDb): Promise<WalletState> => {
    const databaseToRead = database ?? (await activeDb());
    return databaseToRead.transaction(async (db) => {
      const state = {} as WalletState;
      for (const [key, table] of Object.entries(tables))
        (state as any)[key] = await db.all(`SELECT * FROM ${table}`);
      return state;
    });
  },

  /** Existing records always win a same-seed merge; counters can only increase. */
  importState: async (state: WalletState, database?: ExpoSqliteDb): Promise<void> => {
    const databaseToWrite = database ?? (await activeDb());
    await databaseToWrite.transaction(async (db) => {
      for (const [key, table] of Object.entries(tables)) {
        const rows: Record<string, any>[] = (state as any)[key] ?? [];
        const columns = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
        const allowed = new Set(columns.map((column) => column.name));
        for (const input of rows) {
          const row = { ...input };
          if (key === 'mints') {
            row.mintUrl ??= row.url;
            delete row.url;
            row.name ??= 'Restored Mint';
            row.mintInfo ??= '{}';
            row.createdAt ??= Math.floor(Date.now() / 1000);
            row.updatedAt ??= row.createdAt;
            row.trusted = row.trusted === undefined ? 1 : Number(row.trusted);
          }
          if (key === 'changeOperations') parseChangeOperation(row as any);
          // Backup keys are untrusted SQL identifiers, including on old files.
          if (Object.keys(row).some((column) => !allowed.has(column)))
            throw new Error(`Unsupported backup ${key} record.`);
          if (key === 'counters') {
            await db.run(
              `INSERT INTO coco_cashu_counters (mintUrl, keysetId, counter) VALUES (?, ?, ?)
               ON CONFLICT(mintUrl, keysetId) DO UPDATE SET counter = MAX(counter, excluded.counter)`,
              [row.mintUrl, row.keysetId, row.counter],
            );
            continue;
          }
          if (key === 'history') {
            const reference = row.operationId
              ? 'operationId'
              : row.quoteId
                ? 'quoteId'
                : 'tokenJson';
            if (
              row[reference] &&
              (await db.get(
                `SELECT 1 FROM coco_cashu_history WHERE mintUrl = ? AND type = ? AND ${reference} = ?`,
                [row.mintUrl, row.type, row[reference]],
              ))
            )
              continue;
            delete row.id;
          }
          const keys = Object.keys(row);
          if (!keys.length) throw new Error(`Empty backup ${key} record.`);
          // Preserve conflicts without suppressing NOT NULL/CHECK failures.
          await db.run(
            `INSERT INTO ${table} (${keys.map((column) => `"${column}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
            Object.values(row),
          );
        }
      }
    });
  },
};
