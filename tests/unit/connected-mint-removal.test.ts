import { ExpoSqliteDb } from '~/storage/sqlite/db';
import { ensureSchema } from '~/storage/sqlite/schema';
import {
  ConnectedMintRemovalRepository,
  mintRemovalBlock,
} from '~/storage/sqlite/repositories/ConnectedMintRemovalRepository';

const { DatabaseSync } = require('node:sqlite');
const mint = 'https://mint.example';
let native: any;
let db: ExpoSqliteDb;
let repository: ConnectedMintRemovalRepository;

beforeEach(async () => {
  native = new DatabaseSync(':memory:');
  db = new ExpoSqliteDb({
    database: {
      execAsync: async (sql: string) => native.exec(sql),
      runAsync: async (sql: string, ...params: unknown[]) => {
        const result = native.prepare(sql).run(...params);
        return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
      },
      getFirstAsync: async (sql: string, ...params: unknown[]) =>
        native.prepare(sql).get(...params),
      getAllAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).all(...params),
    } as any,
  });
  await ensureSchema(db);
  repository = new ConnectedMintRemovalRepository(db);
  await insert('coco_cashu_mints', { mintUrl: mint, name: 'Synthetic mint', mintInfo: '{}' });
});
afterEach(() => native?.close());

async function insert(table: string, values: Record<string, unknown>) {
  // Populate required fixture fields from the production schema, overriding relevant state.
  const columns = await db.all<any>(`PRAGMA table_info(${table})`);
  const row = { ...values };
  for (const column of columns) {
    if (column.notnull && column.dflt_value === null && !(column.name in row))
      row[column.name] = column.type.includes('INT') ? 0 : 'synthetic';
  }
  const names = Object.keys(row);
  await db.run(
    `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
    Object.values(row),
  );
}

it('disconnects only an empty mint and preserves its counters and history', async () => {
  await insert('coco_cashu_counters', { mintUrl: mint, keysetId: 'keyset', counter: 99 });
  await insert('coco_cashu_history', { mintUrl: mint, type: 'mint', state: 'ISSUED' });
  expect(await repository.inspect(mint)).toBeNull();
  expect(await repository.removeIfEmpty(mint)).toBeNull();
  expect(await db.get('SELECT * FROM coco_cashu_mints WHERE mintUrl = ?', [mint])).toBeUndefined();
  expect(await db.get('SELECT counter FROM coco_cashu_counters WHERE mintUrl = ?', [mint])).toEqual(
    {
      counter: 99,
    },
  );
  expect(await db.get('SELECT state FROM coco_cashu_history WHERE mintUrl = ?', [mint])).toEqual({
    state: 'ISSUED',
  });
});

it.each(['ready', 'inflight'])(
  'protects %s funds even when a UI balance is zero',
  async (state) => {
    await insert('coco_cashu_proofs', { mintUrl: mint, state, amount: 1 });
    expect(await repository.removeIfEmpty(mint)).toBe('funds');
    expect(await db.get('SELECT * FROM coco_cashu_mints WHERE mintUrl = ?', [mint])).toBeDefined();
  },
);

it('rechecks funds received after the selection preview', async () => {
  expect(await repository.inspect(mint)).toBeNull();
  await insert('coco_cashu_proofs', { mintUrl: mint, state: 'ready', amount: 1 });
  expect(await repository.removeIfEmpty(mint)).toBe('funds');
});

it('permits reviewing destructive removal of ready funds while still blocking in-flight proofs', async () => {
  await insert('coco_cashu_proofs', { mintUrl: mint, state: 'ready', amount: 1 });
  expect(await repository.inspect(mint, true)).toBeNull();
  expect(await repository.removeIfEmpty(mint)).toBe('funds');
  await db.run("UPDATE coco_cashu_proofs SET state = 'inflight' WHERE mintUrl = ?", [mint]);
  expect(await repository.inspect(mint, true)).toBe('pending');
});

it('keeps pending payments protected even when a funded removal is explicitly allowed', async () => {
  await insert('coco_cashu_proofs', { mintUrl: mint, state: 'ready', amount: 1 });
  await insert('coco_cashu_melt_quotes', { mintUrl: mint, state: 'PENDING' });
  expect(await repository.inspect(mint, true)).toBe('pending');
  expect(await repository.removeIfEmpty(mint)).toBe('funds');
});

it.each([
  ['coco_cashu_mint_quotes', { state: 'PAID' }, 'pending'],
  ['coco_cashu_mint_quotes', { state: 'UNPAID', expiry: 4000000000 }, 'pending'],
  ['coco_cashu_melt_quotes', { state: 'PENDING' }, 'pending'],
  ['coco_cashu_send_operations', { state: 'pending' }, 'pending'],
  ['coco_cashu_melt_operations', { state: 'executing' }, 'pending'],
  ['bey_change_operations', { state: 'submitted' }, 'pending'],
  ['coco_cashu_history', { type: 'receive', state: 'unclaimed' }, 'unclaimed'],
  ['coco_cashu_nostr_receive_requests', { state: 'pending' }, 'pending'],
  ['bey_wallet_activity', { kind: 'recovery', state: 'review', mintUrls: '[]' }, 'recovery'],
] as const)('protects unresolved state in %s', async (table, values, expected) => {
  await insert(table, { mintUrl: mint, ...values });
  expect(await repository.removeIfEmpty(mint)).toBe(expected);
});

it('protects both sides of an unresolved transfer', async () => {
  await insert('bey_mint_transfers', {
    sourceMintUrl: 'https://source.example',
    targetMintUrl: mint,
    state: 'failed',
    stage: 'issuance',
  });
  expect(await repository.removeIfEmpty(mint)).toBe('pending');
});

it('keeps expired unpaid quotes for late-payment recovery without blocking empty removal', async () => {
  await insert('coco_cashu_mint_quotes', { mintUrl: mint, state: 'UNPAID', expiry: 1 });
  expect(await repository.removeIfEmpty(mint)).toBeNull();
  expect(
    await db.get('SELECT * FROM coco_cashu_mint_quotes WHERE mintUrl = ?', [mint]),
  ).toBeDefined();
});

it('fails closed when wallet state cannot be inspected', async () => {
  await expect(mintRemovalBlock({ get: async () => undefined }, mint)).rejects.toThrow();
  await db.exec('DROP TABLE bey_change_operations');
  await expect(repository.removeIfEmpty(mint)).rejects.toThrow();
  expect(await db.get('SELECT * FROM coco_cashu_mints WHERE mintUrl = ?', [mint])).toBeDefined();
});
