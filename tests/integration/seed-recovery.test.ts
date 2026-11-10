import { ExpoSqliteDb } from '~/storage/sqlite/db';
import { restoreMintFromSeed, saveRecoveryBatch } from '~/services/wallet/seedRecovery';
import { hashToCurve, type Proof } from '@cashu/cashu-ts';

const { DatabaseSync } = require('node:sqlite');
const id = '0011223344556677';
const mintUrl = 'https://mint.test';
let raw: any;
let mockRepo: any;
const mockRestore = jest.fn();
const mockStates = jest.fn();
const mockKeys = jest.fn();
const mockSeed = new Uint8Array(64).fill(1);
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'synthetic fixture',
    deriveSeed: async () => mockSeed,
  },
}));
jest.mock('~/services/wallet/initService', () => ({ initService: { getRepo: () => mockRepo } }));
jest.mock('@cashu/cashu-ts', () => ({
  ...jest.requireActual('@cashu/cashu-ts'),
  Wallet: jest.fn().mockImplementation(() => ({
    loadMint: async () => {},
    mint: {
      getKeySets: async () => ({
        keysets: [
          { id: '0011223344556677', unit: 'sat', active: true },
          { id: '00aabbccddeeff00', unit: 'sat', active: false },
          { id: 'usd', unit: 'usd', active: true },
        ],
      }),
      restore: (...args: unknown[]) => mockRestore(...args),
    },
    keyChain: { ensureKeysetKeys: (...args: unknown[]) => mockKeys(...args) },
    getKeyset: () => ({}),
    checkProofsStates: (...args: unknown[]) => mockStates(...args),
  })),
}));
jest.mock('~/services/wallet/recoveryOutputs', () => ({
  createRecoveryOutputDeriver: (_seed: Uint8Array, keysetId: string) => (counter: number) => ({
    blindedMessage: { B_: `output-${counter}`, amount: 0, id: keysetId },
    toProof: (signature: any) => ({
      id: keysetId,
      secret: `fixture-${counter}`,
      C: 'fixture-signature',
      amount: signature.amount,
    }),
  }),
  recoveryOutputs: async (derive: (counter: number) => unknown, start: number, count: number) =>
    Array.from({ length: count }, (_, i) => derive(start + i)),
}));
jest.mock('~/services/wallet/recoveryProofs', () => ({
  createRecoveryProofConverter: () => (output: any, signature: any) => output.toProof(signature),
}));
const proof = (secret: string, amount = 1): Proof => ({
  id,
  secret,
  amount,
  C: 'fixture-signature',
});
const balanceRows = () =>
  raw.prepare('SELECT secret, state FROM coco_cashu_proofs ORDER BY secret').all();
const counter = () =>
  raw.prepare('SELECT counter FROM coco_cashu_counters WHERE keysetId = ?').get(id)?.counter;
beforeEach(() => {
  jest.clearAllMocks();
  mockSeed.fill(1);
  raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE coco_cashu_counters (mintUrl TEXT, keysetId TEXT, counter INTEGER, PRIMARY KEY(mintUrl,keysetId));
    CREATE TABLE coco_cashu_proofs (mintUrl TEXT, id TEXT, amount INTEGER CHECK(amount > 0), secret TEXT, C TEXT,
    dleqJson TEXT, witnessJson TEXT, state TEXT, createdAt INTEGER, usedByOperationId TEXT, createdByOperationId TEXT,
    PRIMARY KEY(mintUrl,secret));`);
  const database: any = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).get(...params),
    getAllAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).all(...params),
  };
  mockRepo = { db: new ExpoSqliteDb({ database }) };
  mockKeys.mockResolvedValue(undefined);
  mockStates.mockImplementation(async (proofs: Proof[]) =>
    proofs.map((p) => ({
      Y: hashToCurve(new TextEncoder().encode(p.secret)).toHex(true),
      state: 'UNSPENT',
    })),
  );
  mockRestore.mockImplementation(async ({ outputs }: any) => {
    const first = outputs[0];
    return first.id === id && ['output-0', 'output-200'].includes(first.B_)
      ? { outputs: [first], signatures: [{ id, amount: 1, C_: 'fixture' }] }
      : { outputs: [], signatures: [] };
  });
});
afterEach(() => raw.close());

it('rejects signatures for unrequested outputs without saving or advancing a guessed counter', async () => {
  mockRestore.mockResolvedValue({
    outputs: [{ B_: 'unrequested' }],
    signatures: [{ id, amount: 1, C_: 'fixture' }],
  });
  expect(await restoreMintFromSeed(mintUrl, async () => {})).toEqual({ partial: true });
  expect(balanceRows()).toHaveLength(0);
  expect(counter()).toBeUndefined();
});
it('rejects a same-sized state response for a different proof', async () => {
  mockStates.mockResolvedValue([{ Y: 'unrelated-proof', state: 'UNSPENT' }]);
  expect(await restoreMintFromSeed(mintUrl, async () => {})).toEqual({ partial: true });
  expect(balanceRows()).toHaveLength(0);
});

it('deduplicates all existing states and preserves reservations and a higher counter', async () => {
  await saveRecoveryBatch(mockRepo, mintUrl, id, [proof('known')], 1000);
  raw.exec("UPDATE coco_cashu_proofs SET state='inflight', usedByOperationId='operation'");
  await saveRecoveryBatch(mockRepo, mintUrl, id, [proof('known'), proof('new'), proof('new')], 1);
  expect(balanceRows()).toEqual([
    { secret: 'known', state: 'inflight' },
    { secret: 'new', state: 'ready' },
  ]);
  expect(counter()).toBe(1000);
  expect(
    raw.prepare('SELECT usedByOperationId FROM coco_cashu_proofs WHERE secret=?').get('known')
      .usedByOperationId,
  ).toBe('operation');
});
it('rolls back the entire save batch on persistence failure', async () => {
  await expect(saveRecoveryBatch(mockRepo, mintUrl, id, [proof('bad', -1)], 1)).rejects.toThrow();
  expect(balanceRows()).toHaveLength(0);
  expect(counter()).toBeUndefined();
});
it('marks verified spent local proofs spent without releasing in-flight reservations', async () => {
  await saveRecoveryBatch(mockRepo, mintUrl, id, [proof('ready'), proof('reserved')], 2);
  raw.exec(
    "UPDATE coco_cashu_proofs SET state='inflight', usedByOperationId='operation' WHERE secret='reserved'",
  );
  await saveRecoveryBatch(mockRepo, mintUrl, id, [], 1, ['ready', 'reserved']);
  expect(balanceRows()).toEqual([
    { secret: 'ready', state: 'spent' },
    { secret: 'reserved', state: 'inflight' },
  ]);
});
it('rejects incomplete state responses without crediting a partial batch', async () => {
  mockStates.mockResolvedValue([]);
  expect(await restoreMintFromSeed(mintUrl, async () => {})).toEqual({ partial: true });
  expect(counter()).toBe(1);
  expect(balanceRows()).toHaveLength(0);
});
it('scans beyond the first nonempty batch, loads inactive SAT keys and makes repeated scans idempotent', async () => {
  const saved = jest.fn(async () => {});
  expect(await restoreMintFromSeed(mintUrl, saved)).toEqual({ partial: false });
  expect(mockRestore).toHaveBeenCalledTimes(4);
  expect(mockKeys.mock.calls.map(([key]) => key)).toEqual([id, '00aabbccddeeff00']);
  expect(counter()).toBe(201);
  expect(balanceRows()).toHaveLength(2);
  expect(saved).toHaveBeenCalledTimes(2);
  await restoreMintFromSeed(mintUrl, saved);
  expect(balanceRows()).toHaveLength(2);
  expect(saved).toHaveBeenCalledTimes(2);
  expect(mockSeed.every((byte) => byte === 0)).toBe(true);
});
it('advances signature index zero even if spend-state checking fails, without crediting unverified funds', async () => {
  mockStates.mockRejectedValue(new Error('Offline'));
  expect(await restoreMintFromSeed(mintUrl, async () => {})).toEqual({ partial: true });
  expect(counter()).toBe(1);
  expect(balanceRows()).toHaveLength(0);
});
it('does not credit pending proofs as spendable', async () => {
  mockStates.mockImplementation(async (proofs: Proof[]) =>
    proofs.map((p) => ({
      Y: hashToCurve(new TextEncoder().encode(p.secret)).toHex(true),
      state: 'PENDING',
    })),
  );
  const saved = jest.fn(async () => {});
  expect(await restoreMintFromSeed(mintUrl, saved)).toEqual({ partial: true });
  expect(saved).not.toHaveBeenCalled();
  expect(counter()).toBe(201);
  expect(balanceRows()).toHaveLength(0);
});
it('reports aggregate timings without wallet identifiers or proof material', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await restoreMintFromSeed(mintUrl, async () => {});
    const entry = log.mock.calls.find(([label]) => label === '[Recovery timing]')!;
    const report = JSON.parse(entry[1]);
    expect(report).toMatchObject({
      implementation: 'cached-recovery-v5',
      keysets: 2,
      batches: 4,
      outputs: 800,
      signatures: 2,
      partial: false,
    });
    for (const sensitive of [mintUrl, id, 'fixture', 'secret', 'C_'])
      expect(entry[1]).not.toContain(sensitive);
    expect(report.totalMs).toBeGreaterThanOrEqual(0);
  } finally {
    log.mockRestore();
  }
});
it('retains completed batches and reports partial recovery on a later keyset failure', async () => {
  mockKeys.mockImplementation(async (key) => {
    if (key !== id) throw new Error('Unavailable keys');
  });
  expect(await restoreMintFromSeed(mintUrl, async () => {})).toEqual({ partial: true });
  expect(balanceRows()).toHaveLength(2);
});
