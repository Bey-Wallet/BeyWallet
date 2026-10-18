import type { CoreProof } from 'coco-cashu-core';

export const OFFLINE_CHANGE_REQUIRED =
  'Your stored coins cannot make this exact amount offline. Go online once to get change from the mint.';

/** Select existing proofs only; never change their signed amounts or silently round a payment. */
export function findExactSubset(target: number, proofs: CoreProof[]): CoreProof[] | null {
  if (!Number.isSafeInteger(target) || target <= 0) return null;
  const sorted = proofs
    .filter(
      (proof) => Number.isSafeInteger(proof.amount) && proof.amount > 0 && proof.amount <= target,
    )
    .sort((a, b) => b.amount - a.amount);
  let remaining = target;
  const greedy: CoreProof[] = [];
  for (const proof of sorted) {
    if (proof.amount <= remaining) {
      greedy.push(proof);
      remaining -= proof.amount;
      if (remaining === 0) return greedy;
    }
  }
  // Greedy is complete for the standard power-of-two Cashu denominations.
  if (
    sorted.every((proof) => {
      const amount = BigInt(proof.amount);
      return (amount & (amount - 1n)) === 0n;
    })
  )
    return null;

  // Also support non-binary mint denominations, without exponential recursion on the UI thread.
  type Link = { proof: CoreProof; previous: Link | null };
  const reachable = new Map<number, Link | null>([[0, null]]);
  for (const proof of sorted) {
    for (const [sum, previous] of [...reachable]) {
      const next = sum + proof.amount;
      if (next > target || reachable.has(next)) continue;
      const link = { proof, previous };
      if (next === target) {
        const result: CoreProof[] = [];
        for (let node: Link | null = link; node; node = node.previous) result.push(node.proof);
        return result;
      }
      if (reachable.size >= 32768)
        throw new Error(
          'Too many coin combinations to select safely offline. Go online to get change.',
        );
      reachable.set(next, link);
    }
  }
  return null;
}
