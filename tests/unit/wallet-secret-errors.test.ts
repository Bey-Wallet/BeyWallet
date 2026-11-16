import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';
import { ExpoKeyRingRepository } from '~/storage/sqlite/repositories/KeyRingRepository';

const secret = 'synthetic-proof-secret-never-log';
const proof = {
  mintUrl: 'https://mint.test',
  secret,
  id: 'fixture-keyset',
  amount: 1,
  C: 'fixture',
  state: 'ready',
} as any;
let db: any;
beforeEach(() => {
  db = {
    transaction: jest.fn(async (callback) => callback(db)),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  };
});

it('rejects duplicate proofs without exposing their secret', async () => {
  db.get.mockResolvedValue({ x: 1 });
  await expect(new ExpoProofRepository(db).saveProofs(proof.mintUrl, [proof])).rejects.toThrow(
    'Proof already exists.',
  );
  expect(db.run).not.toHaveBeenCalled();
});

it.each([
  [undefined, 'Proof not found.'],
  [{ secret, state: 'spent' }, 'Proof is not ready, cannot reserve.'],
])('rejects invalid reservations without including bearer data', async (row, message) => {
  db.get.mockResolvedValue(row);
  let failure: any;
  try {
    await new ExpoProofRepository(db).reserveProofs(proof.mintUrl, [secret], 'fixture-operation');
  } catch (error) {
    failure = error;
  }
  expect(failure?.message).toBe(message);
  expect(String(failure)).not.toContain(secret);
  expect(failure.cause).toBeUndefined();
  expect(db.run).not.toHaveBeenCalled();
});

it('does not echo reservation identifiers supplied by an imported record', async () => {
  db.get.mockResolvedValue({ secret, state: 'ready', usedByOperationId: secret });
  await expect(
    new ExpoProofRepository(db).reserveProofs(proof.mintUrl, [secret], 'operation'),
  ).rejects.toThrow('Proof is already reserved. Check the existing operation in History.');
  expect(db.run).not.toHaveBeenCalled();
});

it('keeps valid proof reservation behavior and binds the real secret only to SQL', async () => {
  db.get.mockResolvedValue({ secret, state: 'ready', usedByOperationId: null });
  await new ExpoProofRepository(db).reserveProofs(proof.mintUrl, [secret], 'fixture-operation');
  expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE coco_cashu_proofs'), [
    'fixture-operation',
    proof.mintUrl,
    secret,
  ]);
});

it.each(['dleqJson', 'witnessJson'])(
  'does not forward malformed %s payloads through JSON parser errors',
  async (field) => {
    db.all.mockResolvedValue([{ ...proof, [field]: `{"private":"${secret}"` }]);
    await expect(new ExpoProofRepository(db).getAllReadyProofs()).rejects.toThrow(
      'Stored proof metadata is invalid.',
    );
  },
);

it('does not forward key material or parser messages from the keyring', async () => {
  db.get.mockResolvedValue({ publicKey: 'fixture-public', secretKey: secret, derivationIndex: 0 });
  await expect(new ExpoKeyRingRepository(db).getPersistedKeyPair('fixture-public')).rejects.toThrow(
    'Stored key material is invalid.',
  );
  await expect(new ExpoKeyRingRepository(db).getLatestKeyPair()).rejects.toThrow(
    'Stored key material is invalid.',
  );
  db.all.mockResolvedValue([
    { publicKey: 'fixture-public', secretKey: secret, derivationIndex: 0 },
  ]);
  await expect(new ExpoKeyRingRepository(db).getAllPersistedKeyPairs()).rejects.toThrow(
    'Stored key material is invalid.',
  );
});
