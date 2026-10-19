import { prepareEcash } from '~/services/wallet/ecashPayment';
import type { Manager } from 'coco-cashu-core';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';

jest.mock('~/services/wallet/tokenUtils', () => ({ encodeToken: () => 'complete-token' }));

function setup(fee = 0) {
  const send = {
    prepareSend: jest.fn().mockResolvedValue({ id: 'operation', fee }),
    executePreparedSend: jest.fn().mockResolvedValue({ token: {}, operation: { id: 'operation' } }),
    rollback: jest.fn().mockResolvedValue(undefined),
  };
  return {
    send,
    prepare: () =>
      prepareEcash(
        'https://mint.test',
        50,
        async () => ({ send }) as unknown as Manager,
        () =>
          ({
            withTransaction: async (fn: any) =>
              fn({
                mintRepository: { isTrustedMint: async () => true },
                proofRepository: { getAvailableProofs: async () => [] },
              }),
          }) as unknown as ExpoSqliteRepositories,
      ),
  };
}

it.each([0, 3, 12])('reviews the SDK fee %s without executing', async (fee) => {
  const { send, prepare } = setup(fee);
  const review = await prepare();
  expect(review.fee).toBe(fee);
  expect(send.executePreparedSend).not.toHaveBeenCalled();
  await review.dispose();
  await review.dispose();
  expect(send.rollback).toHaveBeenCalledTimes(1);
  await expect(review.execute()).rejects.toThrow('replaced');
});

it('executes once and retains submitted operations during ambiguity', async () => {
  const { send, prepare } = setup();
  const review = await prepare();
  expect(await Promise.all([review.execute(), review.execute()])).toEqual([
    { encoded: 'complete-token', id: 'operation' },
    { encoded: 'complete-token', id: 'operation' },
  ]);
  await review.dispose();
  expect(send.executePreparedSend).toHaveBeenCalledTimes(1);
  expect(send.rollback).not.toHaveBeenCalled();
});

it('does not convert a failed preparation into a zero fee', async () => {
  const { send, prepare } = setup();
  send.prepareSend.mockRejectedValue(new Error('Insufficient balance'));
  await expect(prepare()).rejects.toThrow('Insufficient balance');
  expect(send.executePreparedSend).not.toHaveBeenCalled();
});
