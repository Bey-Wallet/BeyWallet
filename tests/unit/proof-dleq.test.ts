import { hasValidDleq } from '@cashu/cashu-ts';
import { proofService } from '~/services/wallet/proofService';
import { initService } from '~/services/wallet/initService';
import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';

jest.mock('~/services/wallet/initService', () => ({ initService: { getRepo: jest.fn() } }));
jest.mock('~/services/wallet/tokenUtils', () => ({
  cleanToken: jest.fn(),
  decodeToken: jest.fn(),
}));

// Official public NUT-12 Proof vector (not wallet data):
// https://github.com/cashubtc/nuts/blob/main/tests/12-tests.md#dleq-verification-on-proof
const mintUrl = 'https://mint.example';
const publicKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const vector = {
  amount: 1,
  id: '00882760bfa2eb41',
  secret: 'daf4dd00a2b68a0858a80450f52c8a7d2ccf87d375e43e216e0c571f089f63e9',
  C: '024369d2d22a80ecf78f3937da9d5f30c1b9f74f0c32684d583cca0fa6a61cdcfc',
  dleq: {
    e: 'b31e58ac6527f34975ffab13e70a48b6d2b0d35abc4b03f0151f09ee1a9763d4',
    s: '8fbae004c59e754d71df67e392b6ae4e29293113ddc2ec86592a0431d16306d8',
    r: 'a6d13fcd7a18442e6076f5e1e7c887ad5de40a019824bdfa9fe740d302e8d861',
  },
  mintUrl,
  state: 'ready' as const,
};
const keyset = {
  mintUrl,
  id: vector.id,
  active: false,
  keypairs: { '1': { publicKey } },
};

function harness(proofs: unknown[] = [vector], cached: unknown = keyset) {
  const repo = {
    proofRepository: { getReadyProofs: jest.fn().mockResolvedValue(proofs) },
    keysetRepository: { getKeysetById: jest.fn().mockResolvedValue(cached) },
  };
  jest.mocked(initService.getRepo).mockReturnValue(repo as any);
  return repo;
}

it('accepts the official NUT-12 vector using its cached historical keyset', async () => {
  const repo = harness();
  expect(hasValidDleq(vector, { id: vector.id, keys: { '1': publicKey } })).toBe(true);
  expect(
    hasValidDleq({ ...vector, secret: 'tampered' }, { id: vector.id, keys: { '1': publicKey } }),
  ).toBe(false);
  const results = await proofService.verifyDleqProofs(mintUrl);
  expect(results).toEqual([expect.objectContaining({ valid: true, status: 'verified' })]);
  expect(repo.keysetRepository.getKeysetById).toHaveBeenCalledWith(mintUrl, vector.id);
});

it.each([
  { secret: 'tampered' },
  { amount: 2 },
  { amount: 0 },
  { amount: 1.5 },
  { C: publicKey },
  { C: '02' + '00'.repeat(32) },
  { C: 'malformed' },
  { id: '' },
  { mintUrl: 'https://other.example' },
  ...(['e', 's', 'r'] as const).flatMap((field) => [
    { dleq: { ...vector.dleq, [field]: '01'.repeat(32) } },
    { dleq: { ...vector.dleq, [field]: 'not-hex' } },
    { dleq: { ...vector.dleq, [field]: 'ff'.repeat(32) } },
  ]),
])('rejects altered or malformed proof data (%#)', async (change) => {
  harness([{ ...vector, ...change }], {
    ...keyset,
    keypairs: {
      '1': publicKey,
      '2': '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    },
  });
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([
    expect.objectContaining({ valid: false, status: 'invalid' }),
  ]);
});

it.each(['e', 's', 'r'] as const)('cannot verify missing %s', async (field) => {
  harness([{ ...vector, dleq: { ...vector.dleq, [field]: undefined } }]);
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([
    expect.objectContaining({ valid: false, status: 'unverifiable' }),
  ]);
});

it.each([
  null,
  { ...keyset, id: 'another-keyset' },
  { ...keyset, mintUrl: 'https://other.example' },
  { ...keyset, keypairs: undefined },
  { ...keyset, keypairs: {} },
  { ...keyset, keypairs: { '2': publicKey } },
  { ...keyset, keypairs: { '1': {} } },
  { ...keyset, keypairs: { '1': 'not-a-key' } },
  { ...keyset, keypairs: { '1': '02' + '00'.repeat(32) } },
])('cannot verify without usable exact cached keys (%#)', async (cached) => {
  harness([vector], cached);
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([
    expect.objectContaining({ valid: false, status: 'unverifiable' }),
  ]);
});

it('rejects a valid but incorrect denomination public key', async () => {
  harness([vector], {
    ...keyset,
    keypairs: { '1': '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5' },
  });
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([
    expect.objectContaining({ valid: false, status: 'invalid' }),
  ]);
});

it('checks each exact keyset independently and continues after cache and crypto failures', async () => {
  const proofs = [
    { ...vector, id: 'missing' },
    { ...vector, C: '02' + '00'.repeat(32) },
    { ...vector, dleq: {} },
    { ...vector, id: 'other-historical-keyset' },
    vector,
  ];
  const repo = harness(proofs);
  repo.keysetRepository.getKeysetById.mockImplementation(async (_mint, id) => {
    if (id === 'missing') throw new Error('cache failure with sensitive data');
    return { ...keyset, id, keypairs: { '1': publicKey } };
  });
  const snapshot = JSON.stringify(proofs);
  const fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
  try {
    const results = await proofService.verifyDleqProofs(mintUrl);
    expect(results.map(({ status }) => status)).toEqual([
      'unverifiable',
      'invalid',
      'unverifiable',
      'verified',
      'verified',
    ]);
    expect(results.every(({ status, valid }) => valid === (status === 'verified'))).toBe(true);
    expect(JSON.stringify(results)).not.toContain('sensitive data');
    expect(repo.proofRepository.getReadyProofs).toHaveBeenCalledWith(mintUrl);
    expect(repo.keysetRepository.getKeysetById.mock.calls).toEqual([
      [mintUrl, 'missing'],
      [mintUrl, vector.id],
      [mintUrl, 'other-historical-keyset'],
      [mintUrl, vector.id],
    ]);
    expect(JSON.stringify(proofs)).toBe(snapshot);
    expect(fetch).not.toHaveBeenCalled();
    // The harness exposes only reads; any attempted repository write would fail this test.
  } finally {
    fetch.mockRestore();
  }
});

it('skips proofs without stored DLEQ and avoids key reads when there are none', async () => {
  const repo = harness([{ ...vector, dleq: undefined }]);
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([]);
  expect(repo.keysetRepository.getKeysetById).not.toHaveBeenCalled();
});

it('round-trips stored DLEQ unchanged and verifies through the read-only repository path', async () => {
  let row: any;
  const db = {
    get: jest.fn().mockResolvedValue(null),
    run: jest.fn(async (_sql: string, values: unknown[]) => {
      const [mintUrl, id, amount, secret, C, dleqJson] = values;
      row = { mintUrl, id, amount, secret, C, dleqJson, state: 'ready' };
    }),
    all: jest.fn(async () => [row]),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn(db)),
  };
  const repository = new ExpoProofRepository(db as any);
  await repository.saveProofs(mintUrl, [vector]);
  expect(row.dleqJson).toBe(JSON.stringify(vector.dleq));
  expect((await repository.getReadyProofs(mintUrl))[0].dleq).toEqual(vector.dleq);
  const repo = harness();
  jest.mocked(initService.getRepo).mockReturnValue({
    ...repo,
    proofRepository: repository,
  } as any);
  db.run.mockClear();
  db.transaction.mockClear();
  expect(await proofService.verifyDleqProofs(mintUrl)).toEqual([
    expect.objectContaining({ status: 'verified', valid: true }),
  ]);
  expect(db.run).not.toHaveBeenCalled();
  expect(db.transaction).not.toHaveBeenCalled();
  expect(row.dleqJson).toBe(JSON.stringify(vector.dleq));
});
