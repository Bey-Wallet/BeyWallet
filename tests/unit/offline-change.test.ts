import { OfflineChangePlugin } from '~/services/wallet/plugins/OfflineChangePlugin';
import { findExactSubset } from '~/shared/utils/offlineSendUtils';
import type { CoreProof } from 'coco-cashu-core';
import { ProofService } from 'coco-cashu-core';

function setup() {
  let counter = 0;
  const original = jest.fn(async (_mint, amount, _options?: { includeFees?: boolean }) => {
    const outputs = (value: number) => {
      const result: { amount: number; counter: number }[] = [];
      for (let denomination = 1; denomination <= value; denomination *= 2) {
        if (Math.floor(value / denomination) % 2) {
          result.push({ amount: denomination, counter: counter++ });
        }
      }
      return result;
    };
    // Stand in for Coco's existing deterministic generator and persistent counter.
    return {
      keep: outputs(amount.keep),
      send: outputs(amount.send),
      keepAmount: amount.keep,
      sendAmount: amount.send,
    };
  });
  const proofService = {
    createOutputsAndIncrementCounters: original,
    calculateSendAmountWithFees: jest.fn(async (_mint, value) => value + 2),
  };
  const walletService = {
    getWalletWithActiveKeysetId: jest.fn(async () => ({
      keys: {
        keys: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [2 ** i, 'public-key'])),
      },
    })),
  };
  const cleanup = OfflineChangePlugin.onInit!({ services: { proofService, walletService } } as any);
  return { proofService, original, cleanup };
}

it('prepares change that can compose every amount up to its balance, using Coco outputs', async () => {
  const { proofService, original } = setup();
  const result = await proofService.createOutputsAndIncrementCounters('mint', {
    keep: 100,
    send: 16,
  });
  const coins = result.keep.map((output) => ({
    ...output,
    secret: String(output.counter),
  })) as unknown as CoreProof[];
  for (let amount = 1; amount <= 100; amount++)
    expect(findExactSubset(amount, coins)).not.toBeNull();
  expect(result.keep.filter((output) => output.amount === 1)).toHaveLength(4);
  expect(result.keep.reduce((sum, output) => sum + output.amount, 0)).toBe(100);
  expect(result.send.map((output) => output.amount)).toEqual([16]);
  expect(original.mock.calls.length).toBeLessThanOrEqual(6);
});

it('preserves receiver fee coverage and allocates every output a unique consecutive counter', async () => {
  const { proofService } = setup();
  const results = await Promise.all([
    proofService.createOutputsAndIncrementCounters(
      'mint',
      { keep: 34, send: 6 },
      { includeFees: true },
    ),
    proofService.createOutputsAndIncrementCounters('mint', { keep: 64, send: 1 }),
  ]);
  expect(results[0]).toMatchObject({ keepAmount: 32, sendAmount: 8 });
  expect(results[0].send.map((output) => output.amount)).toEqual([8]);
  const counters = results.flatMap((r) => [...r.keep, ...r.send].map((output) => output.counter));
  expect(counters).toEqual(Array.from({ length: counters.length }, (_, i) => i));
  expect(results[0].keep.reduce((sum, output) => sum + output.amount, 0)).toBe(32);
});

it('leaves send-only output denominations unchanged and restores the original on disposal', async () => {
  const { proofService, original, cleanup } = setup();
  const result = await proofService.createOutputsAndIncrementCounters('mint', {
    keep: 0,
    send: 13,
  });
  expect(result.keep).toEqual([]);
  expect(result.send.map((output) => output.amount)).toEqual([1, 4, 8]);
  expect(original).toHaveBeenCalledTimes(1);
  if (typeof cleanup === 'function') cleanup();
  expect(proofService.createOutputsAndIncrementCounters).toBe(original);
});

it('does not reuse counters or poison later operations after a generator failure', async () => {
  const { proofService, original } = setup();
  original.mockRejectedValueOnce(new Error('output failure'));
  await expect(
    proofService.createOutputsAndIncrementCounters('mint', { keep: 10, send: 2 }),
  ).rejects.toThrow('output failure');
  const result = await proofService.createOutputsAndIncrementCounters('mint', {
    keep: 10,
    send: 2,
  });
  const counters = [...result.keep, ...result.send].map((output) => output.counter);
  expect(new Set(counters).size).toBe(counters.length);
});

it('uses the installed Coco deterministic generator and persists its full counter range', async () => {
  let counter = 0;
  const counterService = {
    getCounter: async () => ({ counter }),
    incrementCounter: jest.fn(async (_mint, _keyset, count) => {
      counter += count;
    }),
  };
  const keys = {
    id: '0011223344556677',
    unit: 'sat',
    keys: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        2 ** i,
        '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      ]),
    ),
  };
  const walletService = { getWalletWithActiveKeysetId: async () => ({ keys }) };
  const proofService = new ProofService(
    counterService as any,
    {} as any,
    walletService as any,
    {} as any,
    {} as any,
    { getSeed: async () => new Uint8Array(64).fill(1) } as any,
  );
  const cleanup = await OfflineChangePlugin.onInit!({
    services: { proofService, walletService },
  } as any);
  try {
    const result = await proofService.createOutputsAndIncrementCounters('mint', {
      keep: 100,
      send: 13,
    });
    const all = [...result.keep, ...result.send];
    expect(result.keep.reduce((sum, output) => sum + output.blindedMessage.amount, 0)).toBe(100);
    expect(result.send.map((output) => output.blindedMessage.amount)).toEqual([8, 4, 1]);
    expect(counter).toBe(all.length);
    expect(new Set(all.map((output) => Array.from(output.secret).join(','))).size).toBe(all.length);
    // The next operation must start beyond every output allocated by this one.
    const next = await proofService.createOutputsAndIncrementCounters('mint', { keep: 0, send: 1 });
    expect(counter).toBe(all.length + 1);
    expect(all.map((output) => Array.from(output.secret).join(','))).not.toContain(
      Array.from(next.send[0].secret).join(','),
    );
  } finally {
    if (typeof cleanup === 'function') await cleanup();
  }
});
