import { findExactSubset } from '~/shared/utils/offlineSendUtils';
import type { CoreProof } from 'coco-cashu-core';

const proofs = (amounts: number[]) =>
  amounts.map((amount, index) => ({
    amount,
    secret: `fixture-${index}`,
    id: 'keyset',
    C: 'signature',
  })) as CoreProof[];

it('selects every exact amount from a binary coin inventory without changing signed amounts', () => {
  const available = proofs([1, 2, 4, 8, 16, 32, 64]);
  const original = JSON.stringify(available);
  for (let amount = 1; amount <= 127; amount++) {
    const selected = findExactSubset(amount, available)!;
    expect(selected.reduce((sum, proof) => sum + proof.amount, 0)).toBe(amount);
    expect(new Set(selected).size).toBe(selected.length);
    expect(selected.every((proof) => available.includes(proof))).toBe(true);
  }
  expect(JSON.stringify(available)).toBe(original);
});

it('handles large inventories without recursive stack overflow or a nearby-amount search cutoff', () => {
  const available = proofs([...Array(20000).fill(2), 1]);
  expect(findExactSubset(3, available)?.map((proof) => proof.amount)).toEqual([2, 1]);
  expect(findExactSubset(3, available.slice(0, -1))).toBeNull();
});

it('supports non-binary denominations when greedy selection is insufficient', () => {
  expect(findExactSubset(6, proofs([4, 3, 3]))?.map((proof) => proof.amount)).toEqual([3, 3]);
});

it('distinguishes large safe-integer denominations from nearby powers of two', () => {
  const target = 2 ** 52 + 2;
  const selected = findExactSubset(target, proofs([2 ** 52 + 1, 2 ** 51 + 1, 2 ** 51 + 1]));
  expect(selected?.reduce((sum, proof) => sum + proof.amount, 0)).toBe(target);
});

it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid amounts (%s)', (amount) => {
  expect(findExactSubset(amount, proofs([1, 2]))).toBeNull();
});

it('never manufactures change or rounds the requested amount', () => {
  expect(findExactSubset(5, proofs([8, 16]))).toBeNull();
  expect(findExactSubset(5, proofs([2, 2]))).toBeNull();
});
