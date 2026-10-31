import { findExactSubset, getOfflineAmounts } from '~/shared/utils/offlineSendUtils';
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

it.each([[8, 16, 32], [3, 3, 4], [2, 2, 8], [], [1, 2, 4]])(
  'suggests the nearest payable amounts for inventory %j',
  (...inventory) => {
    const amounts = inventory as number[];
    const available = proofs(amounts);
    const sums = amounts.reduce(
      (reachable, amount) => new Set([...reachable, ...[...reachable].map((sum) => sum + amount)]),
      new Set([0]),
    );
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    for (let target = 1; target <= total + 2; target++) {
      const result = getOfflineAmounts(target, available);
      if (sums.has(target)) {
        expect(result).toEqual({ exact: true, lower: null, higher: null });
      } else {
        const lower = [...sums].filter((sum) => sum > 0 && sum < target);
        const higher = [...sums].filter((sum) => sum > target);
        expect(result).toEqual({
          exact: false,
          lower: lower.length ? Math.max(...lower) : null,
          higher: higher.length ? Math.min(...higher) : null,
        });
        for (const alternative of [result.lower, result.higher]) {
          if (alternative !== null) expect(findExactSubset(alternative, available)).not.toBeNull();
        }
      }
    }
    expect(available.map((proof) => proof.amount)).toEqual(amounts);
  },
);

it('handles large binary inventories and safe integer denominations without scanning amounts', () => {
  expect(getOfflineAmounts(3, proofs(Array(20000).fill(2)))).toEqual({
    exact: false,
    lower: 2,
    higher: 4,
  });
  expect(getOfflineAmounts(2 ** 51 + 1, proofs([2 ** 51, 2 ** 51]))).toEqual({
    exact: false,
    lower: 2 ** 51,
    higher: 2 ** 52,
  });
});
