import { ExpoMintQuoteRepository } from '~/storage/sqlite/repositories/MintQuoteRepository';
import { ExpoMeltQuoteRepository } from '~/storage/sqlite/repositories/MeltQuoteRepository';

const { DatabaseSync } = require('node:sqlite');

it('finds only locally saved invoice quotes, with case-insensitive bound lookups', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec(`
      CREATE TABLE coco_cashu_mint_quotes (
        mintUrl TEXT, quote TEXT, state TEXT, request TEXT, amount INTEGER,
        unit TEXT, expiry INTEGER, pubkey TEXT, PRIMARY KEY (mintUrl, quote)
      );
      CREATE TABLE coco_cashu_melt_quotes (
        mintUrl TEXT, quote TEXT, state TEXT, request TEXT, amount INTEGER,
        unit TEXT, expiry INTEGER, fee_reserve INTEGER, payment_preimage TEXT,
        PRIMARY KEY (mintUrl, quote)
      );
      INSERT INTO coco_cashu_mint_quotes VALUES ('https://mint.test', 'q', 'ISSUED', 'lnbc1invoice', 1, 'sat', 1, NULL);
      INSERT INTO coco_cashu_melt_quotes VALUES ('https://mint.test', 'm', 'PAID', 'lnbc1payment', 1, 'sat', 1, 1, NULL);
    `);
    const db: any = {
      get: async (sql: string, params: unknown[]) => raw.prepare(sql).get(...params),
    };
    const mint = new ExpoMintQuoteRepository(db);
    const melt = new ExpoMeltQuoteRepository(db);
    expect(await mint.findByRequest('LNBC1INVOICE')).toMatchObject({ quote: 'q', state: 'ISSUED' });
    expect(await melt.findByRequest('LNBC1PAYMENT')).toMatchObject({ quote: 'm', state: 'PAID' });
    expect(await mint.findByRequest('unknown')).toBeNull();
    expect(await melt.findByRequest("' OR 1=1 --")).toBeNull();
  } finally {
    raw.close();
  }
});
