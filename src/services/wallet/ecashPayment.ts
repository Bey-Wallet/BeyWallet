import type { Manager } from 'coco-cashu-core';
import { encodeToken } from '~/services/wallet/tokenUtils';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import { prepareLocalEcash } from './offlineEcash';

export interface EcashReview {
  fee: number;
  reclaimAt?: number;
  refundPubkey?: string;
  execute: () => Promise<{ encoded: string; id: string }>;
  dispose: () => Promise<void>;
}

async function getManager() {
  const { initService } = require('./initService') as typeof import('./initService');
  return initService.getManager();
}

function getRepositories() {
  const { initService } = require('./initService') as typeof import('./initService');
  return initService.getRepo();
}

export async function prepareEcash(
  mintUrl: string,
  amount: number,
  manager: () => Promise<Manager> = getManager,
  repositories: () => Pick<ExpoSqliteRepositories, 'withTransaction'> = getRepositories,
): Promise<EcashReview> {
  const local = await prepareLocalEcash(
    mintUrl,
    amount,
    'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2),
    repositories(),
  );
  if (local) return local;
  const m = await manager();
  const prepared = await m.send.prepareSend(mintUrl, amount);
  let disposed = false;
  let submission: Promise<{ encoded: string; id: string }> | undefined;
  return {
    fee: prepared.fee,
    execute: () => {
      if (disposed) return Promise.reject(new Error('Payment review was replaced'));
      return (submission ??= m.send
        .executePreparedSend(prepared.id)
        .then(({ token, operation }) => ({ encoded: encodeToken(token), id: operation.id })));
    },
    dispose: async () => {
      if (disposed || submission) return;
      disposed = true;
      await m.send.rollback(prepared.id);
    },
  };
}
