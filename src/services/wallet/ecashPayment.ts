import type { Manager } from 'coco-cashu-core';
import { encodeToken } from '~/services/wallet/tokenUtils';

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

export async function prepareEcash(
  mintUrl: string,
  amount: number,
  manager: () => Promise<Manager> = getManager,
): Promise<EcashReview> {
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
