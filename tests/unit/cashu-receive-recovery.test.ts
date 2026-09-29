import {
  isDuplicateOutputsError,
  receiveWithDuplicateOutputRecovery,
} from '~/services/wallet/cashuReceiveRecovery';

describe('Cashu receive output recovery', () => {
  it('recognizes the mint duplicate-output code and message', () => {
    expect(isDuplicateOutputsError({ code: 11008, message: 'Mint rejected request' })).toBe(true);
    expect(isDuplicateOutputsError(new Error('Duplicate outputs'))).toBe(true);
    expect(isDuplicateOutputsError(new Error('Proofs are spent'))).toBe(false);
  });

  it('advances through stale output ranges until the receive succeeds', async () => {
    const receive = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(Object.assign(new Error('Duplicate outputs'), { code: 11008 }))
      .mockRejectedValueOnce(Object.assign(new Error('Duplicate outputs'), { code: 11008 }))
      .mockResolvedValue(undefined);

    await expect(receiveWithDuplicateOutputRecovery(receive)).resolves.toBeUndefined();
    expect(receive).toHaveBeenCalledTimes(3);
  });

  it('serializes separate receive operations', async () => {
    let active = 0;
    let maxActive = 0;
    const operation = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
    };

    await Promise.all([
      receiveWithDuplicateOutputRecovery(operation),
      receiveWithDuplicateOutputRecovery(operation),
    ]);
    expect(maxActive).toBe(1);
  });
});
