import { RecoveryTimings } from '~/services/wallet/recoveryTimings';

it('accounts for scheduler and seed work without double-counting nested crypto metrics', () => {
  jest.useFakeTimers();
  try {
    const timings = new RecoveryTimings();
    Object.assign(timings.phases, {
      seedPreparationMs: 50,
      outputPreparationMs: 100,
      outputComputeMs: 80,
      outputYieldMs: 20,
      unblindMs: 200,
      keyPrecomputeMs: 5,
      dleqVerificationMs: 180,
      signatureUnblindMs: 15,
      signatureYieldMs: 25,
      batchYieldMs: 25,
    });
    jest.advanceTimersByTime(500);
    expect(timings.report(false)).toMatchObject({
      implementation: 'cached-recovery-v5',
      totalMs: 500,
      unaccountedMs: 100,
    });
  } finally {
    jest.useRealTimers();
  }
});
