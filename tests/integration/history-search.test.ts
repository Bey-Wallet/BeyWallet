import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { buildHistorySearchIndex, searchHistory } from '~/features/history/historySearch';

const { DatabaseSync } = require('node:sqlite');

it('finds a saved payment outside the recent 200-entry window using the existing unlimited query', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec(`
      CREATE TABLE coco_cashu_history (
        id INTEGER PRIMARY KEY, mintUrl TEXT, type TEXT, unit TEXT, amount INTEGER,
        createdAt INTEGER, metadata TEXT, tokenJson TEXT, operationId TEXT, state TEXT,
        quoteId TEXT, paymentRequest TEXT
      );
      CREATE TABLE bey_mint_transfers (
        targetMintUrl TEXT, mintQuoteId TEXT, sourceMintUrl TEXT, meltQuoteId TEXT, state TEXT
      );
    `);
    const insert = raw.prepare(`INSERT INTO coco_cashu_history
      (id, mintUrl, type, unit, amount, createdAt, metadata) VALUES (?, ?, 'send', 'sat', 1000, ?, ?)`);
    for (let id = 1; id <= 211; id++) {
      insert.run(
        id,
        'https://mint.example',
        id,
        JSON.stringify({ note: id === 1 ? 'Older coffee' : 'Lunch' }),
      );
    }
    const db: any = {
      all: async (sql: string, params: unknown[]) => raw.prepare(sql).all(...params),
    };
    const repository = new ExpoHistoryRepository(db);
    const recent = await repository.getPaginatedHistoryEntries(200, 0);
    const all = await repository.getPaginatedHistoryEntries(-1, 0);
    expect(recent).toHaveLength(200);
    expect(all).toHaveLength(211);
    expect(recent.some((entry) => entry.id === '1')).toBe(false);
    const matches = searchHistory(
      buildHistorySearchIndex(all, { people: {}, mints: [] }),
      'older coffee',
    );
    expect(matches.map((entry) => entry.id)).toEqual(['1']);
    expect(raw.prepare('SELECT COUNT(*) AS total FROM coco_cashu_history').get().total).toBe(211);
  } finally {
    raw.close();
  }
});
