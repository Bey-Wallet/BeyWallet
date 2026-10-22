import { encode as encodeCbor } from 'cbor-x';
import { decodeToken, withTokenMemo } from '~/services/wallet/tokenUtils';

const mint = 'https://mint.example/Bitcoin';
const keyset = Uint8Array.from([1, ...Array(7).fill(171)]);
const commitment = Uint8Array.from([2, ...Array(32).fill(17)]);
const group = {
  i: keyset,
  p: [{ a: 8, s: 'synthetic-preview', c: commitment, w: 'fixture-witness' }],
};

function indefiniteToken(amount: number | bigint = 8) {
  const entries = [
    ['m', mint],
    ['u', 'sat'],
    ['t', [{ ...group, p: [{ ...group.p[0], a: amount }] }]],
    ['d', 'Lunch ☕'],
  ];
  const bytes = Buffer.concat([
    Buffer.from([0xbf]),
    ...entries.flatMap(([key, value]) => [
      Buffer.from(encodeCbor(key)),
      Buffer.from(encodeCbor(value)),
    ]),
    Buffer.from([0xff]),
  ]);
  return (
    'cashuB' + bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  );
}

it('previews ordinary V4 CBOR without requiring a synced keyset or definite map length', () => {
  expect(decodeToken(indefiniteToken())).toMatchObject({
    mint,
    amount: 8,
    unit: 'sat',
    memo: 'Lunch ☕',
    proofs: [
      {
        id: '01' + 'ab'.repeat(7),
        amount: 8,
        secret: 'synthetic-preview',
        C: '02' + '11'.repeat(32),
        witness: 'fixture-witness',
      },
    ],
  });
});

it('keeps the token decodable after adding a memo without a keyset lookup', () => {
  expect(decodeToken(withTokenMemo(indefiniteToken(), 'Offline note'))).toMatchObject({
    mint,
    amount: 8,
    memo: 'Offline note',
  });
});

it('accepts safely representable CBOR 64-bit amounts and rejects unsafe values', () => {
  expect(decodeToken(indefiniteToken(BigInt(8))).amount).toBe(8);
  expect(() => decodeToken(indefiniteToken(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)))).toThrow();
});
