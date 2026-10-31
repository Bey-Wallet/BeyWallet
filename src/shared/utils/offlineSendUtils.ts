import type { CoreProof } from 'coco-cashu-core';

export const OFFLINE_CHANGE_REQUIRED =
  'Your stored coins cannot make this exact amount offline. Go online once to get change from the mint.';

export interface OfflineAmounts {
  exact: boolean;
  lower: number | null;
  higher: number | null;
}

/** Read-only suggestions from existing coins. Zero is never a payable alternative. */
export function getOfflineAmounts(target: number, proofs: CoreProof[]): OfflineAmounts {
  if (!Number.isSafeInteger(target) || target <= 0) throw new Error('Invalid amount');
  if (findExactSubset(target, proofs)) return { exact: true, lower: null, higher: null };
  const amounts = proofs
    .map((proof) => proof.amount)
    .filter((amount) => Number.isSafeInteger(amount) && amount > 0)
    .sort((a, b) => b - a);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Coin balance exceeds the supported range');
  const binary = amounts.every((amount) => {
    const value = BigInt(amount);
    return (value & (value - 1n)) === 0n;
  });
  if (binary) {
    const floor = (limit: number) => {
      let sum = 0;
      for (const amount of amounts) if (amount <= limit - sum) sum += amount;
      return sum;
    };
    const lower = floor(target);
    // A smallest payable upper amount is the complement of a largest payable remainder.
    const higher = total > target ? total - floor(total - target) : null;
    return { exact: false, lower: lower || null, higher };
  }
  const reachable = new Set([0]);
  for (const amount of amounts) {
    for (const sum of [...reachable]) {
      const next = sum + amount;
      if (reachable.has(next)) continue;
      if (reachable.size >= 32768)
        throw new Error(
          'Too many coin combinations to suggest amounts safely. Go online to get change.',
        );
      reachable.add(next);
    }
  }
  let lower: number | null = null;
  let higher: number | null = null;
  for (const sum of reachable) {
    if (sum > 0 && sum < target && (lower === null || sum > lower)) lower = sum;
    if (sum > target && (higher === null || sum < higher)) higher = sum;
  }
  return { exact: false, lower, higher };
}

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
