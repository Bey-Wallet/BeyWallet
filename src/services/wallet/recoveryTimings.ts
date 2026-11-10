/** Aggregate diagnostics only. Never accept mint URLs, keys, proofs or error objects. */
export const recoveryNow = () => globalThis.performance?.now?.() ?? Date.now();
export class RecoveryTimings {
  private started = recoveryNow();
  phases = {
    seedPreparationMs: 0,
    setupMs: 0,
    keysMs: 0,
    deriverSetupMs: 0,
    outputPreparationMs: 0,
    outputComputeMs: 0,
    outputYieldMs: 0,
    restoreRequestMs: 0,
    unblindMs: 0,
    keyPrecomputeMs: 0,
    dleqVerificationMs: 0,
    signatureUnblindMs: 0,
    signatureYieldMs: 0,
    batchYieldMs: 0,
    stateRequestMs: 0,
    stateValidationMs: 0,
    persistenceMs: 0,
    balanceRefreshMs: 0,
  };
  counts = {
    keysets: 0,
    batches: 0,
    outputs: 0,
    signatures: 0,
    dleqSignatures: 0,
    failedKeysets: 0,
  };
  async measure<T>(phase: keyof RecoveryTimings['phases'], task: () => T | Promise<T>): Promise<T> {
    const start = recoveryNow();
    try {
      return await task();
    } finally {
      this.phases[phase] += recoveryNow() - start;
    }
  }
  report(partial: boolean) {
    const totalMs = Math.round(recoveryNow() - this.started);
    const accountedMs =
      this.phases.seedPreparationMs +
      this.phases.setupMs +
      this.phases.keysMs +
      this.phases.deriverSetupMs +
      this.phases.outputPreparationMs +
      this.phases.restoreRequestMs +
      this.phases.unblindMs +
      this.phases.signatureYieldMs +
      this.phases.batchYieldMs +
      this.phases.stateRequestMs +
      this.phases.stateValidationMs +
      this.phases.persistenceMs +
      this.phases.balanceRefreshMs;
    return {
      implementation: 'cached-recovery-v5',
      development: __DEV__,
      engine: (globalThis as { HermesInternal?: unknown }).HermesInternal ? 'Hermes' : 'other',
      partial,
      totalMs,
      unaccountedMs: Math.max(0, Math.round(totalMs - accountedMs)),
      ...this.counts,
      ...Object.fromEntries(
        Object.entries(this.phases).map(([key, value]) => [key, Math.round(value)]),
      ),
    };
  }
}
