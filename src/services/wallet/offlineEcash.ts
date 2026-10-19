import type {
  PendingSendOperation,
  PreparedSendOperation,
  SendHistoryEntry,
} from 'coco-cashu-core';
import type { EcashReview } from './ecashPayment';
import type { Token } from '@cashu/cashu-ts';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import { findExactSubset, OFFLINE_CHANGE_REQUIRED } from '~/shared/utils/offlineSendUtils';
import { encodeToken } from './tokenUtils';
import { notifyLocalSend } from './plugins/LocalSendEventsPlugin';

type LocalRepositories = Pick<ExpoSqliteRepositories, 'withTransaction'>;

/** Reserve an exact local match before review. Missing change alone permits a mint fallback. */
export async function prepareLocalEcash(
  mintUrl: string,
  amount: number,
  operationId: string,
  repositories: LocalRepositories,
): Promise<EcashReview | null> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid amount');
  const prepared = await repositories.withTransaction(async (repo) => {
    if (!(await repo.mintRepository.isTrustedMint(mintUrl))) throw new Error('Mint is not trusted');
    const selected = findExactSubset(
      amount,
      await repo.proofRepository.getAvailableProofs(mintUrl),
    );
    if (!selected) return false;
    const now = Date.now();
    const operation: PreparedSendOperation = {
      id: operationId,
      mintUrl,
      amount,
      state: 'prepared',
      createdAt: now,
      updatedAt: now,
      needsSwap: false,
      fee: 0,
      inputAmount: amount,
      inputProofSecrets: selected.map((proof) => proof.secret),
    };
    try {
      await repo.proofRepository.reserveProofs(mintUrl, operation.inputProofSecrets, operationId);
      await repo.sendOperationRepository.create(operation);
    } catch {
      throw new Error('Local payment preparation failed. No ecash was created.');
    }
    return true;
  });
  if (!prepared) return null;
  let disposed = false;
  let submission: Promise<{ encoded: string; id: string }> | undefined;
  return {
    fee: 0,
    execute: () => {
      if (disposed) return Promise.reject(new Error('Payment review was replaced'));
      return (submission ??= createOfflineEcash(
        mintUrl,
        amount,
        operationId,
        repositories,
        true,
      ).catch((error) => {
        // This path never submits to a mint. A rejected transaction rolled back,
        // so cancellation or a retry can safely use the same prepared operation.
        submission = undefined;
        throw error;
      }));
    },
    dispose: async () => {
      if (disposed || submission) return;
      disposed = true;
      try {
        await repositories.withTransaction(async (repo) => {
          const operation = await repo.sendOperationRepository.getById(operationId);
          if (operation?.state !== 'prepared') throw new Error('Local payment review changed');
          await repo.proofRepository.releaseProofs(mintUrl, operation.inputProofSecrets);
          await repo.sendOperationRepository.update({
            ...operation,
            state: 'rolled_back',
            updatedAt: Date.now(),
          });
        });
      } catch (error) {
        disposed = false;
        throw error;
      }
    },
  };
}

/** The same pending exact-send state as Coco, persisted without loading a wallet or mint data. */
export async function createOfflineEcash(
  mintUrl: string,
  amount: number,
  operationId: string,
  repositories: LocalRepositories,
  reserved = false,
): Promise<{ encoded: string; token: Token; id: string }> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid amount');
  const result = await repositories.withTransaction(async (repo) => {
    if (!(await repo.mintRepository.isTrustedMint(mintUrl))) throw new Error('Mint is not trusted');
    const operation = reserved ? await repo.sendOperationRepository.getById(operationId) : null;
    if (
      reserved &&
      (operation?.state !== 'prepared' ||
        operation.mintUrl !== mintUrl ||
        operation.amount !== amount ||
        operation.needsSwap)
    ) {
      throw new Error('Local payment review changed');
    }
    const available = reserved
      ? (await repo.proofRepository.getProofsByOperationId(mintUrl, operationId)).filter(
          (proof) => proof.state === 'ready' && proof.usedByOperationId === operationId,
        )
      : await repo.proofRepository.getAvailableProofs(mintUrl);
    const selected = findExactSubset(amount, available);
    if (!selected) throw new Error(OFFLINE_CHANGE_REQUIRED);
    const token: Token = {
      mint: mintUrl,
      unit: 'sat',
      proofs: selected.map((proof) => ({
        id: proof.id,
        amount: proof.amount,
        secret: proof.secret,
        C: proof.C,
        ...(proof.dleq ? { dleq: proof.dleq } : {}),
        ...(proof.witness ? { witness: proof.witness } : {}),
      })),
    };
    // Encoding can fail and V4 can shorten keyset IDs. Preserve the full originals in storage.
    let encoded: string;
    try {
      encoded = encodeToken({ ...token, proofs: token.proofs.map((proof) => ({ ...proof })) });
    } catch {
      throw new Error('Offline token encoding failed. No coins were spent.');
    }
    const now = Date.now();
    const pending: PendingSendOperation = {
      id: operationId,
      mintUrl,
      amount,
      state: 'pending',
      createdAt: operation?.createdAt ?? now,
      updatedAt: now,
      needsSwap: false,
      fee: 0,
      inputAmount: amount,
      inputProofSecrets: selected.map((proof) => proof.secret),
    };
    const historyEntry: Omit<SendHistoryEntry, 'id'> = {
      mintUrl,
      unit: 'sat',
      createdAt: now,
      type: 'send',
      amount,
      operationId,
      state: 'pending',
      token,
      metadata: {
        via: 'ecash_create',
        local: 'true',
        ...(!reserved ? { offline: 'true' } : {}),
        fee: '0',
      },
    };
    try {
      if (!reserved)
        await repo.proofRepository.reserveProofs(mintUrl, pending.inputProofSecrets, operationId);
      await repo.proofRepository.setProofState(mintUrl, pending.inputProofSecrets, 'inflight');
      if (reserved) await repo.sendOperationRepository.update(pending);
      else await repo.sendOperationRepository.create(pending);
      await repo.historyRepository.addHistoryEntry(historyEntry);
    } catch {
      // Repository errors may contain proof secrets. Roll back and expose only a fixed message.
      throw new Error('Offline payment storage failed. No ecash was created.');
    }
    return { encoded, token, id: operationId };
  });
  notifyLocalSend(result.token);
  return result;
}
