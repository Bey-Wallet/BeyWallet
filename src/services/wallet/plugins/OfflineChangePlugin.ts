import { getKeepAmounts } from '@cashu/cashu-ts';
import type { Plugin, ProofService } from 'coco-cashu-core';

/** Prepare several small coins as part of existing mint operations, without extra swaps. */
export const OfflineChangePlugin: Plugin<['proofService', 'walletService']> = {
  name: 'offline-change',
  required: ['proofService', 'walletService'],
  onInit: ({ services: { proofService, walletService } }) => {
    const original = proofService.createOutputsAndIncrementCounters;
    type CreateOutputs = ProofService['createOutputsAndIncrementCounters'];
    // Coco owns derivation and counter persistence. Serialize the grouped calls so another
    // operation cannot allocate overlapping counters between the keep and send outputs.
    let queue: Promise<unknown> = Promise.resolve();
    const create: CreateOutputs = (mintUrl, amount, options) => {
      const result = queue.then(async () => {
        if (
          !mintUrl?.trim() ||
          !Number.isSafeInteger(amount.keep) ||
          !Number.isSafeInteger(amount.send) ||
          amount.keep < 0 ||
          amount.send < 0
        ) {
          return original.call(proofService, mintUrl, amount, options);
        }
        const sendAmount =
          options?.includeFees && amount.send > 0
            ? await proofService.calculateSendAmountWithFees(mintUrl, amount.send)
            : amount.send;
        const keepAmount = Math.max(0, amount.keep - (sendAmount - amount.send));
        const keep: Awaited<ReturnType<CreateOutputs>>['keep'] = [];
        if (keepAmount > 0) {
          const { keys } = await walletService.getWalletWithActiveKeysetId(mintUrl);
          const split = getKeepAmounts([], keepAmount, keys.keys, 4);
          // Each layer contains at most one coin of each denomination. Its ordinary
          // binary split reproduces those denominations through Coco's own generator.
          const layers: number[] = [];
          const counts = new Map<number, number>();
          for (const denomination of split) {
            const layer = counts.get(denomination) ?? 0;
            counts.set(denomination, layer + 1);
            layers[layer] = (layers[layer] ?? 0) + denomination;
          }
          for (const value of layers) {
            const output = await original.call(proofService, mintUrl, { keep: value, send: 0 });
            keep.push(...output.keep);
          }
        }
        const sent =
          sendAmount > 0
            ? await original.call(proofService, mintUrl, { keep: 0, send: sendAmount })
            : { send: [] };
        return { keep, send: sent.send, keepAmount, sendAmount };
      });
      queue = result.catch(() => {});
      return result;
    };
    proofService.createOutputsAndIncrementCounters = create;
    return () => {
      if (proofService.createOutputsAndIncrementCounters === create) {
        proofService.createOutputsAndIncrementCounters = original;
      }
    };
  },
};
