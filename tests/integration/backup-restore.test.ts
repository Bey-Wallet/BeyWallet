import { ExpoSqliteRepositories } from '~/storage/sqlite';
import { backupService } from '~/services/wallet/backupService';
import { parseWalletBackup } from '~/services/wallet/walletBackup';
import { verifyBackupProofs } from '~/services/wallet/fileRestoreService';
import { hashToCurve } from '@cashu/cashu-ts';
import { readFileRestorePreview } from '~/services/wallet/fileRestorePreview';

const { DatabaseSync } = require('node:sqlite');
const mockCheckStates = jest.fn();
jest.mock('@cashu/cashu-ts', () => ({
  ...jest.requireActual('@cashu/cashu-ts'),
  Wallet: jest.fn().mockImplementation(() => ({
    checkProofsStates: (...args: unknown[]) => mockCheckStates(...args),
  })),
}));
jest.mock('~/storage/sqlite/fileRestoreStorage', () => ({
  fileRestoreJournal: {},
  fileRestoreDatabaseNames: {},
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
const mnemonic = `${'abandon '.repeat(11)}about`;
const mintUrl = 'https://mint.test';
const proof = (secret: string, state = 'ready') => ({
  mintUrl,
  id: '0011223344556677',
  amount: 1,
  secret,
  C: `02${'11'.repeat(32)}`,
  state,
  createdAt: 1,
});
let raw: any;
let repo: ExpoSqliteRepositories;
beforeEach(async () => {
  jest.clearAllMocks();
  raw = new DatabaseSync(':memory:');
  const database: any = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).get(...params),
    getAllAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).all(...params),
  };
  repo = new ExpoSqliteRepositories({ database });
  await repo.init();
  mockCheckStates.mockImplementation(async (proofs) =>
    proofs.map((p: any) => ({
      Y: hashToCurve(new TextEncoder().encode(p.secret)).toHex(true),
      state: 'UNSPENT',
    })),
  );
});
afterEach(() => raw.close());

it('previews per-mint spendable balance without counting spent, pending or reserved funds', async () => {
  await backupService.importState(
    parseWalletBackup({
      mnemonic,
      mints: [
        { mintUrl, name: 'Mint', nickname: 'Daily' },
        { mintUrl: 'https://empty.test', name: 'Empty mint' },
      ],
      proofs: [
        { ...proof('hidden-ready'), amount: 8 },
        { ...proof('hidden-inflight', 'inflight'), amount: 3 },
        { ...proof('hidden-reserved'), amount: 4, usedByOperationId: 'reserved-operation' },
        { ...proof('hidden-spent', 'spent'), amount: 99 },
      ],
    }),
    repo.db,
  );
  const preview = await readFileRestorePreview(repo.db);
  expect(preview).toEqual({
    balance: 8,
    pendingBalance: 7,
    mints: [
      { mintUrl, name: 'Daily', balance: 8, pendingBalance: 7 },
      { mintUrl: 'https://empty.test', name: 'Empty mint', balance: 0, pendingBalance: 0 },
    ],
  });
  expect(JSON.stringify(preview)).not.toContain('hidden-');
});

it('merges missing records without reviving local spent/reserved proofs or overwriting newer operations, history and mint preferences', async () => {
  const seed = parseWalletBackup({
    mnemonic,
    mints: [{ mintUrl, name: 'Original', trusted: 0 }],
    proofs: [
      proof('spent', 'spent'),
      { ...proof('reserved', 'inflight'), usedByOperationId: 'send-1' },
    ],
    counters: [{ mintUrl, keysetId: 'keyset', counter: 100 }],
    sendOperations: [
      { id: 'send-1', mintUrl, amount: 1, state: 'finalized', createdAt: 1, updatedAt: 10 },
    ],
    history: [
      {
        mintUrl,
        type: 'send',
        unit: 'sat',
        amount: 1,
        createdAt: 1,
        operationId: 'send-1',
        state: 'finalized',
      },
    ],
  });
  await backupService.importState(seed, repo.db);
  const older = parseWalletBackup({
    ...seed,
    version: 3,
    mints: [{ mintUrl, name: 'Old name', trusted: 1 }],
    proofs: [proof('spent'), proof('reserved'), proof('fresh')],
    counters: [{ mintUrl, keysetId: 'keyset', counter: 2 }],
    sendOperations: [
      {
        ...seed.sendOperations[0],
        state: 'pending',
        updatedAt: 2,
        inputAmount: 1,
        needsSwap: 0,
        inputProofSecretsJson: '["reserved"]',
      },
    ],
    history: [{ ...seed.history[0], state: 'pending' }],
  });
  const checked = await verifyBackupProofs(older, repo);
  expect(mockCheckStates.mock.calls[0][0].map((p: any) => p.secret)).toEqual(['fresh']);
  await backupService.importState(checked, repo.db);
  expect(raw.prepare('SELECT state FROM coco_cashu_proofs WHERE secret=?').get('spent').state).toBe(
    'spent',
  );
  expect(
    raw.prepare('SELECT state FROM coco_cashu_proofs WHERE secret=?').get('reserved').state,
  ).toBe('inflight');
  expect(raw.prepare('SELECT state FROM coco_cashu_proofs WHERE secret=?').get('fresh').state).toBe(
    'ready',
  );
  expect(raw.prepare('SELECT counter FROM coco_cashu_counters').get().counter).toBe(100);
  expect(raw.prepare('SELECT state FROM coco_cashu_send_operations').get().state).toBe('finalized');
  expect(raw.prepare('SELECT state FROM coco_cashu_history').all()).toEqual([
    { state: 'finalized' },
  ]);
  expect(raw.prepare('SELECT name,trusted FROM coco_cashu_mints').get()).toEqual({
    name: 'Original',
    trusted: 0,
  });
});

it('round-trips pending sends, Lightning payments, quotes and their key material through the database snapshot', async () => {
  const backup = parseWalletBackup({
    mnemonic,
    sendOperations: [
      {
        id: 'send-1',
        mintUrl,
        amount: 1,
        state: 'pending',
        createdAt: 1,
        updatedAt: 2,
        inputProofSecretsJson: '["fixture"]',
        inputAmount: 1,
        needsSwap: 0,
        outputDataJson: '{"keep":[],"send":[]}',
      },
    ],
    meltOperations: [
      {
        id: 'melt-1',
        mintUrl,
        state: 'pending',
        createdAt: 1,
        updatedAt: 2,
        method: 'bolt11',
        methodDataJson: '{}',
        quoteId: 'quote-1',
        inputAmount: 1,
        needsSwap: 0,
        inputProofSecretsJson: '["fixture"]',
      },
    ],
    meltQuotes: [
      {
        mintUrl,
        quote: 'quote-1',
        state: 'PENDING',
        request: 'fixture',
        amount: 1,
        unit: 'sat',
        expiry: 3,
        fee_reserve: 0,
      },
    ],
    keypairs: [
      {
        publicKey: 'fixture-public',
        secretKey: 'fixture-secret',
        createdAt: 1,
        derivationIndex: 10,
      },
    ],
  });
  await backupService.importState(backup, repo.db);
  const saved = await backupService.exportState(repo.db);
  expect(saved.sendOperations[0]).toMatchObject(backup.sendOperations[0]);
  expect(saved.meltOperations[0]).toMatchObject(backup.meltOperations[0]);
  expect(saved.meltQuotes?.[0]).toMatchObject(backup.meltQuotes![0]);
  expect(saved.keypairs?.[0]).toMatchObject(backup.keypairs![0]);
});

it('rolls back all imports on a malformed record and rejects injected SQL identifiers', async () => {
  const backup = parseWalletBackup({
    mnemonic,
    mints: [{ mintUrl }],
    proofs: [proof('fresh')],
    history: [{ mintUrl, type: 'send', amount: 1, createdAt: 1 }],
  });
  await expect(backupService.importState(backup, repo.db)).rejects.toThrow();
  expect(raw.prepare('SELECT * FROM coco_cashu_mints').all()).toEqual([]);
  expect(raw.prepare('SELECT * FROM coco_cashu_proofs').all()).toEqual([]);
  await expect(
    backupService.importState(
      { ...backup, sendOperations: [], mints: [{ mintUrl, 'name) VALUES (?) --': 'bad' }] },
      repo.db,
    ),
  ).rejects.toThrow('Unsupported backup');
});

it.each(['SPENT', 'PENDING'])('does not restore a %s proof as spendable', async (state) => {
  const backup = parseWalletBackup({ mnemonic, proofs: [proof('restored')] });
  mockCheckStates.mockResolvedValue([
    { Y: hashToCurve(new TextEncoder().encode('restored')).toHex(true), state },
  ]);
  const checked = await verifyBackupProofs(backup, repo);
  expect(checked.proofs[0].state).toBe(state === 'SPENT' ? 'spent' : 'inflight');
});

it('fails closed for offline, partial, duplicated, or unrelated mint responses', async () => {
  const backup = parseWalletBackup({ mnemonic, proofs: [proof('restored')] });
  for (const states of [
    [],
    [{ Y: 'unrelated', state: 'UNSPENT' }],
    [{ Y: 'unrelated', state: 'invalid' }],
  ]) {
    mockCheckStates.mockResolvedValueOnce(states);
    await expect(verifyBackupProofs(backup, repo)).rejects.toThrow();
  }
  mockCheckStates.mockRejectedValueOnce(new Error('offline'));
  await expect(verifyBackupProofs(backup, repo)).rejects.toThrow();
  expect(raw.prepare('SELECT * FROM coco_cashu_proofs').all()).toEqual([]);
});
