import { MIGRATIONS } from '~/storage/sqlite/schema';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  WalletActivityRepository,
  type WalletActivity,
} from '~/storage/sqlite/repositories/WalletActivityRepository';
const { DatabaseSync } = require('node:sqlite');

const sample = (changes: Partial<WalletActivity> = {}): WalletActivity => ({
  id: 'activity:optimize:one',
  kind: 'optimize',
  mintUrl: 'https://mint.test',
  state: 'pending',
  createdAt: 1000,
  updatedAt: 1000,
  inputAmount: 32,
  fee: null,
  balanceDelta: null,
  beforeCount: 10,
  afterCount: null,
  operationId: 'operation-one',
  receiveHistoryId: null,
  completedCount: null,
  totalCount: null,
  observedBalance: null,
  mintUrls: ['https://mint.test'],
  ...changes,
});

function setup(path = ':memory:') {
  const raw = new DatabaseSync(path);
  raw.exec(MIGRATIONS.find((m) => m.id === '022_wallet_activity')!.sql);
  raw.exec(
    'CREATE TABLE bey_change_operations(id TEXT PRIMARY KEY, mintUrl TEXT, state TEXT, createdAt INTEGER, data TEXT)',
  );
  const db: any = {
    run: async (sql: string, params: unknown[] = []) => raw.prepare(sql).run(...params),
    all: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
  };
  return { raw, db, repo: new WalletActivityRepository(db) };
}

it('persists one operation through repository recreation and never downgrades a confirmed outcome', async () => {
  const { raw, db, repo } = setup();
  try {
    await repo.save(sample());
    await repo.save(
      sample({
        state: 'completed',
        afterCount: 2,
        receiveHistoryId: 'receipt-one',
        updatedAt: 2000,
      }),
    );
    await repo.save(sample({ state: 'pending', createdAt: 3000 }));
    const restarted = new WalletActivityRepository(db);
    expect(await restarted.list()).toHaveLength(1);
    expect(await restarted.get(sample().id)).toMatchObject({
      state: 'completed',
      createdAt: 1000,
      receiveHistoryId: 'receipt-one',
      fee: null,
      balanceDelta: null,
    });
    await restarted.hide(sample().id);
    expect(await restarted.get(sample().id)).toBeUndefined();
    expect((await restarted.list())[0].hidden).toBe(true);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM bey_wallet_activity').get().n).toBe(1);
  } finally {
    raw.close();
  }
});

it('keeps completion, grouping identities and hidden markers after closing and reopening the database', async () => {
  const file = join(tmpdir(), `bey-activity-test-${randomUUID()}.sqlite`);
  const { raw, repo } = setup(file);
  try {
    await repo.save(sample({ state: 'completed', receiveHistoryId: 'receipt-one' }));
    await repo.hide(sample().id);
  } finally {
    raw.close();
  }
  const reopened = new DatabaseSync(file);
  try {
    const restarted = new WalletActivityRepository({
      all: async (sql: string, params: unknown[] = []) => reopened.prepare(sql).all(...params),
    } as any);
    expect(await restarted.get(sample().id)).toBeUndefined();
    expect((await restarted.list())[0]).toMatchObject({ state: 'completed', hidden: true });
    expect(await restarted.optimizationLinks()).toEqual([
      {
        mintUrl: 'https://mint.test',
        operationId: 'operation-one',
        receiveHistoryId: 'receipt-one',
      },
    ]);
  } finally {
    reopened.close();
    unlinkSync(file);
  }
});

it('projects only submitted and confirmed change with exact fees, without exposing its journal', async () => {
  const { raw, repo } = setup();
  try {
    const insert = raw.prepare('INSERT INTO bey_change_operations VALUES (?, ?, ?, ?, ?)');
    for (const state of ['prepared', 'submitted', 'completed', 'canceled']) {
      insert.run(
        state,
        'https://mint.test',
        state,
        1000,
        JSON.stringify({
          id: state,
          mintUrl: 'https://mint.test',
          state,
          inputAmount: 32,
          outputAmount: 31,
          fee: 1,
          inputSecrets: ['SYNTHETIC_PRIVATE_INPUT'],
          outputs: { keep: [{ secret: 'SYNTHETIC_PRIVATE_OUTPUT' }, {}] },
        }),
      );
    }
    insert.run('bad', 'https://mint.test', 'completed', 1, '{bad json');
    insert.run(
      'wrong',
      'https://mint.test',
      'completed',
      2,
      JSON.stringify({
        id: 'other',
        mintUrl: 'https://mint.test',
        state: 'completed',
        inputAmount: 32,
        outputAmount: 31,
        fee: 1,
      }),
    );
    const records = await repo.list();
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.state === 'completed')).toMatchObject({
      fee: 1,
      balanceDelta: -1,
      beforeCount: 1,
      afterCount: 2,
    });
    expect(records.find((r) => r.state === 'review')).toMatchObject({
      fee: null,
      balanceDelta: null,
      afterCount: null,
    });
    expect(JSON.stringify(records)).not.toMatch(/SYNTHETIC_PRIVATE|inputSecrets|outputs/);
    await repo.hide('activity:change:completed');
    expect(await repo.get('activity:change:completed')).toBeUndefined();
    expect(raw.prepare('SELECT COUNT(*) AS n FROM bey_change_operations').get().n).toBe(6);
  } finally {
    raw.close();
  }
});
