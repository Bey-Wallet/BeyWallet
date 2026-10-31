import { mintManager } from '~/services/wallet/mintManager';
import { ExpoMintRepository } from '~/storage/sqlite/repositories/MintRepository';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';

const { DatabaseSync } = require('node:sqlite');
let mockRepo: any;
let mockManager: any;
jest.mock('~/services/wallet/initService', () => ({
  initService: { getRepo: () => mockRepo, getManager: () => mockManager },
}));

it.each(['sdk', 'repository'])(
  'keeps receipts queryable after %s mint removal while clearing balance data',
  async (path) => {
    const raw = new DatabaseSync(':memory:');
    const removedUrl = 'https://removed.example';
    const otherUrl = 'https://other.example';
    try {
      raw.exec(`
      CREATE TABLE coco_cashu_mints (mintUrl TEXT PRIMARY KEY);
      CREATE TABLE coco_cashu_history (
        id INTEGER PRIMARY KEY, mintUrl TEXT, type TEXT, unit TEXT, amount INTEGER,
        createdAt INTEGER, metadata TEXT, tokenJson TEXT, operationId TEXT, state TEXT,
        quoteId TEXT, paymentRequest TEXT
      );
      CREATE TABLE bey_mint_transfers (
        targetMintUrl TEXT, mintQuoteId TEXT, sourceMintUrl TEXT, meltQuoteId TEXT, state TEXT
      );
    `);
      const cleanupTables = ['keysets', 'counters', 'proofs', 'mint_quotes', 'melt_quotes'];
      for (const table of cleanupTables) {
        raw.exec(`CREATE TABLE coco_cashu_${table} (mintUrl TEXT);`);
        raw.prepare(`INSERT INTO coco_cashu_${table} VALUES (?)`).run(removedUrl);
        raw.prepare(`INSERT INTO coco_cashu_${table} VALUES (?)`).run(otherUrl);
      }
      raw.prepare('INSERT INTO coco_cashu_mints VALUES (?)').run(removedUrl);
      raw.prepare('INSERT INTO coco_cashu_mints VALUES (?)').run(otherUrl);
      raw
        .prepare(
          `INSERT INTO coco_cashu_history
      (id, mintUrl, type, unit, amount, createdAt) VALUES (1, ?, 'receive', 'sat', 123, 1000)`,
        )
        .run(removedUrl);
      const db: any = {
        run: async (sql: string, params: unknown[]) => raw.prepare(sql).run(...params),
        get: async (sql: string, params: unknown[]) => raw.prepare(sql).get(...params),
        all: async (sql: string, params: unknown[]) => raw.prepare(sql).all(...params),
      };
      const mintRepository = new ExpoMintRepository(db);
      const historyRepository = new ExpoHistoryRepository(db);
      mockRepo = { db, mintRepository };
      mockManager = {
        mint: path === 'sdk' ? { removeMint: (url: string) => mintRepository.deleteMint(url) } : {},
      };
      const before = await historyRepository.getHistoryEntryById('1');

      await mintManager.removeMint(removedUrl);

      expect(
        raw.prepare('SELECT * FROM coco_cashu_mints WHERE mintUrl = ?').get(removedUrl),
      ).toBeUndefined();
      expect(await historyRepository.getHistoryEntryById('1')).toEqual(before);
      expect(await historyRepository.getPaginatedHistoryEntries(-1, 0)).toEqual([before]);
      for (const table of cleanupTables) {
        expect(raw.prepare(`SELECT mintUrl FROM coco_cashu_${table}`).all()).toEqual([
          { mintUrl: otherUrl },
        ]);
      }
      // Reconnecting must not erase or duplicate the historical receipt.
      raw.prepare('INSERT INTO coco_cashu_mints VALUES (?)').run(removedUrl);
      expect(await historyRepository.getPaginatedHistoryEntries(-1, 0)).toEqual([before]);
    } finally {
      raw.close();
    }
  },
);
