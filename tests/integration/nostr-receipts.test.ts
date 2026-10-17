import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { MIGRATIONS } from '~/storage/sqlite/schema';
import { matchesReceiveReceipt } from '~/services/wallet/nostrReceiptService';
import { getEncodedTokenV3 } from '@cashu/cashu-ts';
const { DatabaseSync } = require('node:sqlite');

it('only exposes completed receive records as receipt candidates, preserving offline offers', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec(MIGRATIONS.find((migration) => migration.id === '003_history')!.sql);
    raw.exec('ALTER TABLE coco_cashu_history ADD COLUMN operationId TEXT');
    const token = {
      mint: 'https://mint.example',
      unit: 'sat',
      proofs: [
        {
          id: '01' + 'ab'.repeat(32),
          amount: 8,
          secret: 'synthetic-receipt',
          C: '02' + '11'.repeat(32),
        },
      ],
    };
    const insert = raw.prepare(
      'INSERT INTO coco_cashu_history (mintUrl, type, unit, amount, createdAt, state, tokenJson) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    insert.run(token.mint, 'receive', 'sat', 8, 1, 'unclaimed', JSON.stringify(token));
    insert.run(token.mint, 'send', 'sat', 8, 2, 'finalized', JSON.stringify(token));
    insert.run(
      token.mint,
      'receive',
      'sat',
      8,
      3,
      null,
      JSON.stringify({ ...token, proofs: [{ ...token.proofs[0], secret: 'other-payment' }] }),
    );
    const repo = new ExpoHistoryRepository({
      all: async (sql: string, params: unknown[]) => raw.prepare(sql).all(...params),
    } as any);
    const encoded = getEncodedTokenV3(token);
    expect(
      (await repo.getSuccessfulReceiveCandidates(8, 'sat')).some((entry) =>
        matchesReceiveReceipt(encoded, entry),
      ),
    ).toBe(false);
    insert.run(token.mint, 'receive', 'sat', 8, 4, null, JSON.stringify(token));
    insert.run(token.mint, 'receive', 'sat', 8, 5, null, 'malformed-old-row');
    const entries = await repo.getSuccessfulReceiveCandidates(8, 'sat');
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => matchesReceiveReceipt(encoded, entry))?.id).toBe('4');
    expect(raw.prepare('SELECT state FROM coco_cashu_history WHERE id = 1').get().state).toBe(
      'unclaimed',
    );
  } finally {
    raw.close();
  }
});
