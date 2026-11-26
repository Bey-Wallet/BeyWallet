import { bech32 } from 'bech32';
import { ExpoSqliteDb } from '~/storage/sqlite/db';
import { MIGRATIONS } from '~/storage/sqlite/schema';
import { ExpoMeltOperationRepository } from '~/storage/sqlite/repositories/MeltOperationRepository';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import {
  historyBalanceEffect,
  historyStatusLabel,
} from '~/features/history/transactionPresentation';

const { DatabaseSync } = require('node:sqlite');
let raw: any;
let db: ExpoSqliteDb;
let operations: ExpoMeltOperationRepository;
let history: ExpoHistoryRepository;
const invoice = bech32.encode('lnbc200n', Array(111).fill(0), 20000);
const initial = {
  id: 'payment-1',
  mintUrl: 'https://mint.example',
  method: 'bolt11',
  methodData: { invoice },
  state: 'init',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
} as const;
const prepared = {
  ...initial,
  state: 'prepared',
  quoteId: 'quote-1',
  amount: 20,
  fee_reserve: 3,
  swap_fee: 1,
  inputAmount: 24,
  needsSwap: false,
  inputProofSecrets: ['NEVER_IN_HISTORY'],
  changeOutputData: { keep: [], send: [] },
} as const;
const save = (operation: any) => operations.update(operation);
const receipts = () => history.getPaginatedHistoryEntries(-1, 0);

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  raw.exec(MIGRATIONS.find((migration) => migration.id === '001_initial')!.sql);
  raw.exec(MIGRATIONS.find((migration) => migration.id === '003_history')!.sql);
  raw.exec(MIGRATIONS.find((migration) => migration.id === '011_melt_operations')!.sql);
  raw.exec(MIGRATIONS.find((migration) => migration.id === '012_settings')!.sql);
  // Production adds app annotations to the SDK history schema.
  const columns = raw
    .prepare('PRAGMA table_info(coco_cashu_history)')
    .all()
    .map((row: any) => row.name);
  for (const column of ['operationId', 'metadata', 'paymentRequest', 'tokenJson']) {
    if (!columns.includes(column))
      raw.exec(`ALTER TABLE coco_cashu_history ADD COLUMN ${column} TEXT`);
  }
  raw.exec(`CREATE TABLE bey_mint_transfers (
    id TEXT, targetMintUrl TEXT, mintQuoteId TEXT, sourceMintUrl TEXT, meltQuoteId TEXT, state TEXT
  )`);
  db = new ExpoSqliteDb({
    database: {
      execAsync: async (sql: string) => raw.exec(sql),
      runAsync: async (sql: string, ...params: any[]) => {
        const result = raw.prepare(sql).run(...params);
        return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
      },
      getFirstAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).get(...params),
      getAllAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).all(...params),
    } as any,
  });
  operations = new ExpoMeltOperationRepository(db);
  history = new ExpoHistoryRepository(db);
});
afterEach(() => raw.close());

it('persists one receipt from preparation through settlement, including after reopening repositories', async () => {
  await operations.create(initial as any);
  expect(await receipts()).toMatchObject([
    { amount: 20, state: 'preparing', operationId: initial.id },
  ]);
  const id = (await receipts())[0].id;
  await save(prepared);
  expect(historyBalanceEffect((await receipts())[0])).toBe('none');
  await save({ ...prepared, state: 'executing' });
  await save({ ...prepared, state: 'pending' });
  operations = new ExpoMeltOperationRepository(db);
  await operations.reconcileHistory();
  await operations.reconcileHistory();
  expect(await receipts()).toMatchObject([{ id, state: 'pending', quoteId: 'quote-1' }]);
  expect(historyBalanceEffect((await receipts())[0])).toBe('debit');
  await save({ ...prepared, state: 'finalized' });
  const all = await receipts();
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({ id, state: 'PAID', paymentRequest: invoice });
  expect(JSON.stringify(all)).not.toContain('NEVER_IN_HISTORY');
  expect(historyStatusLabel(all[0])).toBe('Confirmed');
});

it('keeps a failed preparation receipt after the SDK deletes its init operation', async () => {
  await operations.create(initial as any);
  await operations.delete(initial.id);
  expect(await operations.getById(initial.id)).toBeNull();
  expect(await receipts()).toMatchObject([{ state: 'failed', amount: 20 }]);
  expect(historyBalanceEffect((await receipts())[0])).toBe('none');
});

it('distinguishes cancellation before submission from a submitted payment returned by recovery', async () => {
  await operations.create(initial as any);
  await save(prepared);
  await save({ ...prepared, state: 'rolling_back' });
  await save({ ...prepared, state: 'rolled_back' });
  expect(await receipts()).toMatchObject([{ state: 'cancelled', metadata: { submitted: false } }]);
  await operations.create({ ...initial, id: 'payment-2' } as any);
  const second = { ...prepared, id: 'payment-2', quoteId: 'quote-2' };
  await save(second);
  await save({ ...second, state: 'executing' });
  await save({ ...second, state: 'rolling_back' });
  expect((await history.getMeltHistoryEntry(initial.mintUrl, 'quote-2'))?.state).toBe('unresolved');
  await save({ ...second, state: 'rolled_back' });
  expect((await history.getMeltHistoryEntry(initial.mintUrl, 'quote-2'))?.state).toBe('failed');
});

it('backfills a legacy operation without duplicating its existing quote receipt', async () => {
  await operations.create(initial as any);
  await save(prepared);
  raw.prepare('UPDATE coco_cashu_history SET operationId = NULL').run();
  await operations.reconcileHistory();
  await operations.reconcileHistory();
  expect(await receipts()).toHaveLength(1);
  expect((await receipts())[0]).toMatchObject({ operationId: initial.id, quoteId: 'quote-1' });
});

it('records quote-check failures as failed rather than user-cancelled after rollback', async () => {
  await operations.create(initial as any);
  await save(prepared);
  await save({ ...prepared, state: 'rolled_back', error: 'Bey: preparation failed' });
  expect(await receipts()).toMatchObject([{ state: 'failed', metadata: { submitted: false } }]);
  expect(historyBalanceEffect((await receipts())[0])).toBe('none');
});

it('respects deliberate history deletion when an operation is updated or the wallet reopens', async () => {
  await operations.create(initial as any);
  await save(prepared);
  await history.deleteHistoryEntriesByIds([(await receipts())[0].id]);
  await save({ ...prepared, state: 'rolled_back' });
  await operations.reconcileHistory();
  expect(await receipts()).toHaveLength(0);
  expect(await operations.getById(initial.id)).not.toBeNull();
});

it('rolls back the operation write when its corresponding receipt cannot be saved', async () => {
  raw.exec(
    `CREATE TRIGGER reject_receipt BEFORE INSERT ON coco_cashu_history BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END`,
  );
  await expect(operations.create(initial as any)).rejects.toThrow('storage unavailable');
  expect(await operations.getById(initial.id)).toBeNull();
});

it('serializes concurrent observations into one receipt and preserves a confirmed result', async () => {
  await operations.create(initial as any);
  await save(prepared);
  await Promise.all([
    save({ ...prepared, state: 'pending' }),
    save({ ...prepared, state: 'pending' }),
  ]);
  expect(await receipts()).toHaveLength(1);
  await save({ ...prepared, state: 'finalized' });
  await save({ ...prepared, state: 'prepared' });
  expect(await receipts()).toMatchObject([{ state: 'PAID' }]);
});

it('tolerates malformed legacy receipt annotations while excluding operation secrets', async () => {
  await operations.create(initial as any);
  raw.prepare('UPDATE coco_cashu_history SET metadata = ?, state = NULL').run('null');
  await save({ ...prepared, methodData: { invoice, secretKey: 'PRIVATE_KEY_MARKER' } });
  expect(await receipts()).toHaveLength(1);
  expect(JSON.stringify(await receipts())).not.toMatch(/NEVER_IN_HISTORY|PRIVATE_KEY_MARKER/);
});
