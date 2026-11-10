import {
  createBlindSignature,
  createDLEQProof,
  getPubKeyFromPrivKey,
  OutputData,
  pointFromHex,
  verifyDLEQProof,
  type SerializedBlindedSignature,
} from '@cashu/cashu-ts';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { createRecoveryProofConverter, verifyRecoveryDleq } from '~/services/wallet/recoveryProofs';

jest.mock('@cashu/cashu-ts', () => {
  const actual = jest.requireActual('@cashu/cashu-ts');
  return { ...actual, pointFromHex: jest.fn(actual.pointFromHex) };
});

// Public synthetic fixtures; no wallet storage or live mint is accessed.
const seed = Uint8Array.from({ length: 64 }, (_, i) => i + 1);
const legacyId = '0011223344556677';
const mintKeys = {
  1: new Uint8Array(32).fill(7),
  2: new Uint8Array(32).fill(9),
};

// NUT-12 BlindSignature vector: https://github.com/cashubtc/nuts/blob/main/tests/12-tests.md
const vector = {
  A: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  B: '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2',
  C: '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2',
  e: '9818e061ee51d5c8edc3342369a554998ff7b4381c8652d724cdf46429be73d9',
  s: '9818e061ee51d5c8edc3342369a554998ff7b4381c8652d724cdf46429be73da',
};

it('accepts the official NUT-12 blind-signature vector and rejects altered public points', () => {
  const dleq = { s: hexToBytes(vector.s), e: hexToBytes(vector.e) };
  const A = pointFromHex(vector.A);
  const B = pointFromHex(vector.B);
  const C = pointFromHex(vector.C);
  expect(verifyDLEQProof(dleq, B, C, A)).toBe(true);
  expect(verifyRecoveryDleq(dleq, B, C, A)).toBe(true);
  for (const points of [
    [B.negate(), C, A],
    [B, C.negate(), A],
    [B, C, A.negate()],
  ]) {
    expect(verifyDLEQProof(dleq, points[0], points[1], points[2])).toBe(false);
    expect(verifyRecoveryDleq(dleq, points[0], points[1], points[2])).toBe(false);
  }
});

it.each(['s', 'e'] as const)('retains strict rejection of invalid public scalar %s', (field) => {
  const points = [pointFromHex(vector.B), pointFromHex(vector.C), pointFromHex(vector.A)] as const;
  for (const invalid of [
    new Uint8Array(32),
    new Uint8Array(31),
    new Uint8Array(33),
    new Uint8Array(32).fill(255),
    hexToBytes('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
  ]) {
    const dleq = { s: hexToBytes(vector.s), e: hexToBytes(vector.e), [field]: invalid };
    expect(() => verifyDLEQProof(dleq, ...points)).toThrow();
    expect(() => verifyRecoveryDleq(dleq, ...points)).toThrow();
  }
});
function fixture(id = legacyId, counter = 0, amount: 1 | 2 = 1, withDleq = true) {
  const output = OutputData.createSingleDeterministicData(0, seed, counter, id);
  output.blindedMessage.amount = amount;
  const B = pointFromHex(output.blindedMessage.B_);
  const privateKey = mintKeys[amount];
  const signature = createBlindSignature(B, privateKey, amount, id);
  const dleq = withDleq ? createDLEQProof(B, privateKey) : undefined;
  return {
    output,
    signature: {
      id,
      amount,
      C_: signature.C_.toHex(true),
      ...(dleq && { dleq: { s: bytesToHex(dleq.s), e: bytesToHex(dleq.e) } }),
    } satisfies SerializedBlindedSignature,
    keyset: {
      id,
      keys: {
        1: bytesToHex(getPubKeyFromPrivKey(mintKeys[1])),
        2: bytesToHex(getPubKeyFromPrivKey(mintKeys[2])),
      },
    },
  };
}

it.each([legacyId, 'ABEiM0RVZnc=', '01' + '11'.repeat(32)])(
  'matches cashu-ts proof bytes and DLEQ metadata for %s',
  (id) => {
    for (const counter of [0, 199, 200]) {
      for (const amount of [1, 2] as const) {
        for (const withDleq of [false, true]) {
          const { output, signature, keyset } = fixture(id, counter, amount, withDleq);
          expect(createRecoveryProofConverter(keyset)(output, signature)).toEqual(
            output.toProof(signature, keyset),
          );
        }
      }
    }
  },
);

it('reuses a public key within a scan and releases the cache between scans', () => {
  const first = fixture();
  const next = fixture(legacyId, 1);
  jest.mocked(pointFromHex).mockClear();
  const convert = createRecoveryProofConverter(first.keyset);
  convert(first.output, first.signature);
  convert(next.output, next.signature);
  expect(
    jest.mocked(pointFromHex).mock.calls.filter(([hex]) => hex === first.keyset.keys[1]),
  ).toHaveLength(1);
  createRecoveryProofConverter(first.keyset)(first.output, first.signature);
  expect(
    jest.mocked(pointFromHex).mock.calls.filter(([hex]) => hex === first.keyset.keys[1]),
  ).toHaveLength(2);
});

it('uses variable-time multiplication only with public s/e, never the secret blinding factor', () => {
  const { output, signature, keyset } = fixture();
  const convert = createRecoveryProofConverter(keyset);
  const prototype = Object.getPrototypeOf(pointFromHex(keyset.keys[1]));
  const multiply = jest.spyOn(prototype, 'multiplyUnsafe');
  try {
    convert(output, signature);
    const publicScalars = [BigInt(`0x${signature.dleq!.s}`), BigInt(`0x${signature.dleq!.e}`)];
    expect(multiply).toHaveBeenCalled();
    for (const [scalar] of multiply.mock.calls) {
      expect(publicScalars).toContain(scalar);
      expect(scalar).not.toBe(output.blindingFactor);
    }
  } finally {
    multiply.mockRestore();
  }
});

it.each(['s', 'e'] as const)('rejects a modified DLEQ %s without returning a proof', (field) => {
  const { output, signature, keyset } = fixture();
  signature.dleq![field] = '11'.repeat(32);
  expect(() => createRecoveryProofConverter(keyset)(output, signature)).toThrow('DLEQ');
  expect(() => output.toProof(signature, keyset)).toThrow('DLEQ');
});

it('rejects a valid DLEQ from a different output and a mismatched amount key', () => {
  const first = fixture();
  const next = fixture(legacyId, 1);
  expect(() => createRecoveryProofConverter(first.keyset)(first.output, next.signature)).toThrow(
    'DLEQ',
  );
  expect(() =>
    createRecoveryProofConverter(first.keyset)(first.output, { ...first.signature, amount: 2 }),
  ).toThrow('DLEQ');
});

it('rejects malformed points and DLEQ hex rather than silently dropping validation', () => {
  const { output, signature, keyset } = fixture();
  const convert = createRecoveryProofConverter(keyset);
  expect(() => convert(output, { ...signature, C_: 'invalid' })).toThrow();
  expect(() =>
    convert(output, { ...signature, dleq: { ...signature.dleq!, s: 'not-hex' } }),
  ).toThrow();
  expect(() =>
    createRecoveryProofConverter({ ...keyset, keys: { 1: 'invalid' } })(output, signature),
  ).toThrow();
});

it('rejects mismatched keysets, missing keys and invalid amounts', () => {
  const { output, signature, keyset } = fixture();
  const convert = createRecoveryProofConverter(keyset);
  expect(() => convert(output, { ...signature, id: 'another-keyset' })).toThrow();
  expect(() =>
    createRecoveryProofConverter({ ...keyset, id: 'another-keyset' })(output, signature),
  ).toThrow();
  for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() => convert(output, { ...signature, amount })).toThrow();
  expect(() => createRecoveryProofConverter({ ...keyset, keys: {} })(output, signature)).toThrow();
});
