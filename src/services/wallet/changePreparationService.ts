import { OutputData, hasValidDleq, type Proof } from '@cashu/cashu-ts';
import type { CoreProof } from 'coco-cashu-core';
import * as Network from 'expo-network';
import { Buffer } from 'buffer';
import {
  ChangeOperationRepository,
  type ChangeOperation,
  type ChangeOutputs,
} from '~/storage/sqlite/repositories/ChangeOperationRepository';
import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import { getChangeServices, type ChangeServices } from './plugins/ChangePreparationPlugin';

export interface ChangeReview {
  id: string;
  mintUrl: string;
  inputAmount: number;
  fee: number;
  outputAmount: number;
  submitted: boolean;
  execute(): Promise<{ amount: number; coinCount: number }>;
  dispose(): Promise<void>;
}

const pendingMessage = 'Change preparation is unfinished. Reconnect and retry this operation.';
export class ChangePreparationError extends Error {
  constructor(
    message: string,
    readonly needsReview = false,
  ) {
    super(message);
  }
}

function requireUnlocked(): void {
  const { useSettingsStore } =
    require('~/state/settingsStore') as typeof import('~/state/settingsStore');
  const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
  if (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated)
    throw new ChangePreparationError('Unlock your wallet first.');
}

/** Inputs and replacement outputs stay private in the local operation journal. */
export class ChangePreparation {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private repositories: Pick<
      ExpoSqliteRepositories,
      'db' | 'proofRepository' | 'mintRepository' | 'keysetRepository'
    >,
    private services: ChangeServices,
    private online = async () => {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false || state.isInternetReachable === false)
        throw new ChangePreparationError('Go online to get change.');
    },
    private authorize: () => void = requireUnlocked,
  ) {}

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }

  async prepare(mintUrl: string): Promise<ChangeReview> {
    return this.serial(async () => {
      this.authorize();
      await this.online();
      if (!(await this.repositories.mintRepository.isTrustedMint(mintUrl)))
        throw new ChangePreparationError('Select a trusted mint.');
      const journal = new ChangeOperationRepository(this.repositories.db);
      const pending = (await journal.pending(mintUrl))[0];
      if (pending) return this.review(pending);
      const { wallet } = await this.services.walletService.getWalletWithActiveKeysetId(mintUrl);
      const info = await wallet.mint.getInfo();
      if (!info.nuts?.[9]?.supported)
        throw new ChangePreparationError(
          'This mint does not support recoverable change preparation.',
        );
      const inputs = await this.repositories.proofRepository.getAvailableProofs(mintUrl);
      const inputAmount = inputs.reduce((sum, proof) => sum + proof.amount, 0);
      const fee = wallet.getFeesForProofs(inputs);
      const outputAmount = inputAmount - fee;
      if (!Number.isSafeInteger(inputAmount) || inputAmount <= 0)
        throw new ChangePreparationError('No available balance at this mint.');
      if (!Number.isSafeInteger(fee) || fee < 0 || outputAmount <= 0)
        throw new ChangePreparationError('Mint fees consume the available balance.');
      const operation: ChangeOperation = {
        id: 'change_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2),
        mintUrl,
        state: 'prepared',
        inputAmount,
        fee,
        outputAmount,
        inputSecrets: inputs.map((proof) => proof.secret),
        outputs: { keep: [], send: [] },
        createdAt: Date.now(),
      };
      // Reserve first, without a network call inside the transaction. Counter allocation
      // may leave a harmless unused range if output creation or persistence fails.
      await this.repositories.db.transaction(async (db) => {
        await new ExpoProofRepository(db).reserveProofs(
          mintUrl,
          operation.inputSecrets,
          operation.id,
        );
        await new ChangeOperationRepository(db).save(operation);
      });
      try {
        const outputs = await this.services.proofService.createOutputsAndIncrementCounters(
          mintUrl,
          { keep: outputAmount, send: 0 },
        );
        operation.outputs = {
          keep: outputs.keep.map((output) => ({
            blindedMessage: { ...output.blindedMessage },
            blindingFactor: output.blindingFactor.toString(16),
            secret: Buffer.from(output.secret).toString('hex'),
          })),
          send: [],
        };
        if (
          outputs.keep.reduce((sum, output) => sum + output.blindedMessage.amount, 0) !==
          outputAmount
        )
          throw new ChangePreparationError('Invalid change outputs');
        await journal.save(operation);
      } catch {
        await this.cancel(operation);
        throw new ChangePreparationError('Could not prepare change. No swap was submitted.');
      }
      return this.review(operation);
    });
  }

  private async cancel(operation: ChangeOperation): Promise<void> {
    await this.repositories.db.transaction(async (db) => {
      const journal = new ChangeOperationRepository(db);
      const current = await journal.get(operation.id);
      if (!current || current.state === 'canceled') return;
      if (current.state !== 'prepared') throw new ChangePreparationError(pendingMessage);
      await new ExpoProofRepository(db).releaseProofs(operation.mintUrl, operation.inputSecrets);
      await journal.save({ ...current, state: 'canceled' });
    });
  }

  private review(operation: ChangeOperation): ChangeReview {
    let submission: Promise<{ amount: number; coinCount: number }> | undefined;
    return {
      id: operation.id,
      mintUrl: operation.mintUrl,
      inputAmount: operation.inputAmount,
      fee: operation.fee,
      outputAmount: operation.outputAmount,
      submitted: operation.state === 'submitted',
      execute: () =>
        (submission ??= this.serial(() => this.execute(operation.id)).catch((error) => {
          submission = undefined;
          throw error;
        })),
      dispose: () =>
        this.serial(async () => {
          const current = await new ChangeOperationRepository(this.repositories.db).get(
            operation.id,
          );
          if (current?.state === 'prepared') await this.cancel(current);
        }),
    };
  }

  private async execute(id: string): Promise<{ amount: number; coinCount: number }> {
    this.authorize();
    await this.online();
    const journal = new ChangeOperationRepository(this.repositories.db);
    let operation = await journal.get(id);
    if (!operation || operation.state === 'canceled')
      throw new ChangePreparationError('Review the change operation again.');
    if (operation.state === 'completed')
      return { amount: operation.outputAmount, coinCount: operation.outputs.keep.length };
    if (!(await this.repositories.mintRepository.isTrustedMint(operation.mintUrl)))
      throw new ChangePreparationError('Mint is not trusted.');
    const { wallet } = await this.services.walletService.getWalletWithActiveKeysetId(
      operation.mintUrl,
    );
    const inputs = (
      await this.repositories.proofRepository.getProofsByOperationId(operation.mintUrl, id)
    ).filter(
      (proof) => proof.usedByOperationId === id && operation!.inputSecrets.includes(proof.secret),
    );
    if (
      inputs.length !== operation.inputSecrets.length ||
      inputs.reduce((sum, proof) => sum + proof.amount, 0) !== operation.inputAmount
    )
      throw new ChangePreparationError('Reserved coins changed. Review the operation again.');
    if (operation.state === 'prepared') {
      if (
        !inputs.every((proof) => proof.state === 'ready') ||
        wallet.getFeesForProofs(inputs) !== operation.fee ||
        !operation.outputs.keep.length
      ) {
        await this.cancel(operation);
        throw new ChangePreparationError(
          'The mint fee or available coins changed. Review again.',
          true,
        );
      }
      operation = { ...operation, state: 'submitted' };
      await journal.save(operation);
    }
    try {
      this.authorize();
      // Restore first: the mint may already have accepted this exact output set.
      const restored = await wallet.mint.restore({
        outputs: operation.outputs.keep.map((output) => output.blindedMessage),
      });
      let proofs: Proof[];
      if (restored.outputs.length) {
        if (
          restored.outputs.length !== operation.outputs.keep.length ||
          restored.signatures.length !== restored.outputs.length
        )
          throw new ChangePreparationError('Incomplete restore');
        proofs = [];
        const seen = new Set<string>();
        for (let i = 0; i < restored.outputs.length; i++) {
          const planned = operation.outputs.keep.find(
            (output) => output.blindedMessage.B_ === restored.outputs[i].B_,
          );
          const signature = restored.signatures[i];
          if (
            !planned ||
            seen.has(planned.secret) ||
            signature.id !== planned.blindedMessage.id ||
            signature.amount !== planned.blindedMessage.amount
          )
            throw new ChangePreparationError('Unexpected restore output');
          seen.add(planned.secret);
          // Use the keyset already validated and cached by Coco when outputs were
          // generated. A restore response must not introduce replacement mint keys.
          const cached = await this.repositories.keysetRepository.getKeysetById(
            operation.mintUrl,
            signature.id,
          );
          if (!cached || cached.unit !== 'sat' || !Object.keys(cached.keypairs).length)
            throw new ChangePreparationError('Missing output keys');
          const keys = { id: cached.id, keys: cached.keypairs };
          const proof = this.output(planned).toProof(signature, keys);
          if (proof.dleq && !hasValidDleq(proof, keys))
            throw new ChangePreparationError('Invalid output verification');
          proofs.push(proof);
        }
      } else {
        const states = await wallet.checkProofsStates(inputs);
        if (states.length !== inputs.length || !states.every((state) => state.state === 'UNSPENT'))
          throw new ChangePreparationError('Input status is uncertain');
        this.authorize();
        proofs = await wallet.receive(
          { mint: operation.mintUrl, unit: 'sat', proofs: inputs },
          undefined,
          {
            type: 'custom',
            data: operation.outputs.keep.map((output) => this.output(output)),
          },
        );
      }
      this.validateProofs(operation, proofs);
      const states = await wallet.checkProofsStates(proofs);
      if (states.length !== proofs.length || !states.every((state) => state.state === 'UNSPENT'))
        throw new ChangePreparationError('Output status is uncertain');
      const finished = operation;
      await this.repositories.db.transaction(async (db) => {
        const repository = new ExpoProofRepository(db);
        await repository.saveProofs(
          finished.mintUrl,
          proofs.map(
            (proof) =>
              ({
                ...proof,
                mintUrl: finished.mintUrl,
                state: 'ready',
                createdByOperationId: id,
              }) as CoreProof,
          ),
        );
        await repository.setProofState(finished.mintUrl, finished.inputSecrets, 'spent');
        await new ChangeOperationRepository(db).save({ ...finished, state: 'completed' });
      });
      // No send/receive events: this is maintenance, not a payment.
      void this.services.eventBus
        .emit('proofs:saved', {
          mintUrl: operation.mintUrl,
          keysetId: proofs[0].id,
          proofs: proofs.map(
            (proof) => ({ ...proof, mintUrl: operation!.mintUrl, state: 'ready' }) as CoreProof,
          ),
        })
        .catch(() => {});
      return { amount: operation.outputAmount, coinCount: proofs.length };
    } catch {
      // Do not expose SDK exceptions containing proofs, or free submitted inputs.
      throw new ChangePreparationError(pendingMessage);
    }
  }

  private output(output: ChangeOutputs['keep'][number]): OutputData {
    return new OutputData(
      output.blindedMessage,
      BigInt('0x' + output.blindingFactor),
      new Uint8Array(Buffer.from(output.secret, 'hex')),
    );
  }

  private validateProofs(operation: ChangeOperation, proofs: Proof[]): void {
    const expected = new Map(
      operation.outputs.keep.map((output) => [
        Buffer.from(output.secret, 'hex').toString('utf8'),
        output.blindedMessage,
      ]),
    );
    if (
      proofs.length !== expected.size ||
      new Set(proofs.map((proof) => proof.secret)).size !== expected.size ||
      proofs.some((proof) => {
        const output = expected.get(proof.secret);
        return !output || proof.id !== output.id || proof.amount !== output.amount;
      }) ||
      proofs.reduce((sum, proof) => sum + proof.amount, 0) !== operation.outputAmount
    )
      throw new ChangePreparationError('Unexpected change proofs');
  }

  async recoverPending(): Promise<void> {
    await this.serial(async () => {
      for (const operation of await new ChangeOperationRepository(this.repositories.db).pending()) {
        if (operation.state === 'prepared') await this.cancel(operation);
        else {
          try {
            await this.execute(operation.id);
          } catch {
            /* Retain the journal for retry in Settings. */
          }
        }
      }
    });
  }
}

let engine: ChangePreparation | undefined;
let owner: ExpoSqliteRepositories | undefined;
export function getChangePreparation(): ChangePreparation {
  const { initService } = require('./initService') as typeof import('./initService');
  const repositories = initService.getRepo();
  if (owner !== repositories) {
    engine = new ChangePreparation(repositories, getChangeServices());
    owner = repositories;
  }
  return engine!;
}
