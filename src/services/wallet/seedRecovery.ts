import { Wallet, hashToCurve, type Proof } from '@cashu/cashu-ts';
import { seedService } from '~/services/platform/seedService';
import { createRecoveryOutputDeriver, recoveryOutputs } from './recoveryOutputs';
import { yieldWalletWork } from './recoveryCoordinator';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';
import { ExpoCounterRepository } from '~/storage/sqlite/repositories/CounterRepository';
import { RecoveryTimings, recoveryNow } from './recoveryTimings';
import { createRecoveryProofConverter } from './recoveryProofs';

const BATCH_SIZE = 200;

/** Atomic deduplication across ALL proof states; never resurrect reserved/spent proofs. */
export async function saveRecoveryBatch(
  repo: ExpoSqliteRepositories,
  mintUrl: string,
  keysetId: string,
  proofs: Proof[],
  nextCounter: number,
  spentSecrets: string[] = [],
) {
  return repo.db.transaction(async (db) => {
    const counters = new ExpoCounterRepository(db);
    const current = await counters.getCounter(mintUrl, keysetId);
    await counters.setCounter(mintUrl, keysetId, Math.max(current?.counter ?? 0, nextCounter));
    const known = proofs.length
      ? await db.all<{ secret: string }>(
          `SELECT secret FROM coco_cashu_proofs WHERE mintUrl = ? AND secret IN (${proofs.map(() => '?').join(',')})`,
          [mintUrl, ...proofs.map((proof) => proof.secret)],
        )
      : [];
    const secrets = new Set(known.map((proof) => proof.secret));
    const fresh = proofs.filter((proof) => {
      if (secrets.has(proof.secret)) return false;
      secrets.add(proof.secret);
      return true;
    });
    await new ExpoProofRepository(db).saveProofs(
      mintUrl,
      fresh.map((proof) => ({ ...proof, mintUrl, state: 'ready' as const })),
    );
    const spentChanges = spentSecrets.length
      ? await db.run(
          `UPDATE coco_cashu_proofs SET state = 'spent' WHERE mintUrl = ? AND id = ? AND state = 'ready' AND secret IN (${spentSecrets.map(() => '?').join(',')})`,
          [mintUrl, keysetId, ...spentSecrets],
        )
      : undefined;
    return fresh.length > 0 || (spentChanges?.changes ?? 0) > 0;
  });
}

export async function restoreMintFromSeed(mintUrl: string, saved: () => Promise<void>) {
  const { initService } = require('./initService') as typeof import('./initService');
  const repo = initService.getRepo();
  const timings = new RecoveryTimings();
  const seed = await timings.measure('seedPreparationMs', async () => {
    const mnemonic = await seedService.getMnemonic();
    if (!mnemonic) throw new Error('Wallet seed is unavailable');
    return seedService.deriveSeed(mnemonic);
  });
  const wallet = new Wallet(mintUrl, { unit: 'sat', bip39seed: seed });
  let partial = false;
  let finished = false;
  try {
    await timings.measure('setupMs', () => wallet.loadMint());
    const { keysets } = await timings.measure('setupMs', () => wallet.mint.getKeySets());
    const eligible = keysets.filter((keyset) =>
      ['sat', 'sats', ''].includes((keyset.unit || '').toLowerCase()),
    );
    if (!eligible.length) throw new Error('The mint has no SAT keysets to recover');
    timings.counts.keysets = eligible.length;
    for (const keyset of eligible) {
      try {
        // This public API fetches and validates inactive keys as well as active keys.
        await timings.measure('keysMs', () => wallet.keyChain.ensureKeysetKeys(keyset.id));
        const keys = wallet.getKeyset(keyset.id);
        const toProof = createRecoveryProofConverter(keys, timings.phases);
        const derive = await timings.measure('deriverSetupMs', () =>
          createRecoveryOutputDeriver(seed, keyset.id),
        );
        let start = 0;
        let empty = false;
        while (!empty) {
          timings.counts.batches++;
          const outputs = await timings.measure('outputPreparationMs', () =>
            recoveryOutputs(derive, start, BATCH_SIZE, timings.phases),
          );
          timings.counts.outputs += outputs.length;
          const restored = await timings.measure('restoreRequestMs', () =>
            wallet.mint.restore({
              outputs: outputs.map((output) => output.blindedMessage),
            }),
          );
          if (restored.outputs.length !== restored.signatures.length)
            throw new Error('Incomplete restore response');
          timings.counts.dleqSignatures += restored.signatures.filter(
            (signature) => signature.dleq,
          ).length;
          const requested = new Map(
            outputs.map((output, i) => [output.blindedMessage.B_, { output, counter: start + i }]),
          );
          const seen = new Set<string>();
          const proofs: Proof[] = [];
          timings.counts.signatures += restored.signatures.length;
          let nextCounter = 0;
          for (const [i, output] of restored.outputs.entries()) {
            const match = requested.get(output.B_);
            const signature = restored.signatures[i];
            if (
              !match ||
              seen.has(output.B_) ||
              signature.id !== keyset.id ||
              !Number.isSafeInteger(signature.amount) ||
              signature.amount <= 0
            )
              throw new Error('Invalid restore response');
            seen.add(output.B_);
            match.output.blindedMessage.amount = signature.amount;
            const unblindStarted = recoveryNow();
            proofs.push(toProof(match.output, signature));
            timings.phases.unblindMs += recoveryNow() - unblindStarted;
            nextCounter = Math.max(nextCounter, match.counter + 1);
            if (i % 8 === 0) await timings.measure('signatureYieldMs', yieldWalletWork);
          }
          empty = proofs.length === 0;
          if (!empty) {
            // Consumed signature indices must never be reused, even if the
            // subsequent spend-state request fails or the app is interrupted.
            await timings.measure('persistenceMs', () =>
              saveRecoveryBatch(repo, mintUrl, keyset.id, [], nextCounter),
            );
            const states = await timings.measure('stateRequestMs', () =>
              wallet.checkProofsStates(proofs),
            );
            const validationStarted = recoveryNow();
            const byY = new Map(states.map((state) => [state.Y, state.state]));
            if (states.length !== proofs.length || byY.size !== proofs.length)
              throw new Error('Incomplete proof-state response');
            const ready: Proof[] = [];
            const spent: string[] = [];
            for (const proof of proofs) {
              const state = byY.get(
                hashToCurve(new TextEncoder().encode(proof.secret)).toHex(true),
              );
              if (!state || !['UNSPENT', 'SPENT', 'PENDING'].includes(state))
                throw new Error('Invalid proof-state response');
              if (state === 'UNSPENT') ready.push(proof);
              if (state === 'SPENT') spent.push(proof.secret);
              if (state === 'PENDING') partial = true;
            }
            timings.phases.stateValidationMs += recoveryNow() - validationStarted;
            const changed = await timings.measure('persistenceMs', () =>
              saveRecoveryBatch(repo, mintUrl, keyset.id, ready, nextCounter, spent),
            );
            if (changed) await timings.measure('balanceRefreshMs', saved);
          }
          start += BATCH_SIZE;
          await timings.measure('batchYieldMs', yieldWalletWork);
        }
      } catch {
        // Keep completed batches and continue with other historical keysets.
        partial = true;
        timings.counts.failedKeysets++;
      }
    }
    finished = true;
  } finally {
    seed.fill(0);
    console.info('[Recovery timing]', JSON.stringify(timings.report(partial || !finished)));
  }
  return { partial };
}
