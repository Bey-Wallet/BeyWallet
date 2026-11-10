import { HDKey } from '@scure/bip32';
import { blindMessage, getKeysetIdInt, OutputData } from '@cashu/cashu-ts';
import { Buffer } from 'buffer';
import { yieldWalletWork } from './recoveryCoordinator';
import { recoveryNow } from './recoveryTimings';

/** Same NUT-13 legacy paths, with their shared parent computed once per keyset. */
export function createRecoveryOutputDeriver(seed: Uint8Array, keysetId: string) {
  const legacy = keysetId.startsWith('00') || !/^[a-fA-F0-9]+$/.test(keysetId);
  const parent = legacy
    ? HDKey.fromMasterSeed(seed).derive(`m/129372'/0'/${getKeysetIdInt(keysetId)}'`)
    : undefined;
  return (counter: number) => {
    if (!parent) return OutputData.createSingleDeterministicData(0, seed, counter, keysetId);
    if (!Number.isInteger(counter) || counter < 0 || counter >= 0x80000000)
      throw new Error('Recovery counter is outside the supported range');
    const base = parent.deriveChild(0x80000000 + counter);
    const secretBytes = base.deriveChild(0).privateKey;
    const factorBytes = base.deriveChild(1).privateKey;
    if (!secretBytes || !factorBytes) throw new Error('Recovery derivation failed');
    const secret = new TextEncoder().encode(Buffer.from(secretBytes).toString('hex'));
    const factor = BigInt(`0x${Buffer.from(factorBytes).toString('hex')}`);
    const { B_, r } = blindMessage(secret, factor);
    return new OutputData({ amount: 0, id: keysetId, B_: B_.toHex(true) }, r, secret);
  };
}

export async function recoveryOutputs(
  derive: ReturnType<typeof createRecoveryOutputDeriver>,
  start: number,
  count: number,
  timings?: { outputComputeMs: number; outputYieldMs: number },
) {
  const outputs: OutputData[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 8 === 0) {
      const start = recoveryNow();
      await yieldWalletWork();
      if (timings) timings.outputYieldMs += recoveryNow() - start;
    }
    const computeStarted = recoveryNow();
    outputs.push(derive(start + i));
    if (timings) timings.outputComputeMs += recoveryNow() - computeStarted;
  }
  return outputs;
}
