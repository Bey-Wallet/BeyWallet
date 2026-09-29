const MAX_DUPLICATE_OUTPUT_RETRIES = 4;

let receiveQueue: Promise<void> = Promise.resolve();

export function isDuplicateOutputsError(error: unknown): boolean {
  const candidate = error as { code?: number | string; message?: string } | null;
  return (
    Number(candidate?.code) === 11008 ||
    /duplicate outputs/i.test(candidate?.message || (error instanceof Error ? error.message : ''))
  );
}

async function runWithDuplicateOutputRecovery(operation: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (!isDuplicateOutputsError(error) || attempt >= MAX_DUPLICATE_OUTPUT_RETRIES) throw error;

      // Coco reserves and persists a new deterministic-output counter range before
      // each mint request. Retrying therefore advances past outputs the mint has
      // already seen without weakening proof or P2PK validation.
      console.warn(
        `[WalletService] Mint rejected a reused output range; retrying with fresh outputs (${attempt + 1}/${MAX_DUPLICATE_OUTPUT_RETRIES})`,
      );
    }
  }
}

/** Serialize receive swaps and recover a bounded number of stale counter ranges. */
export function receiveWithDuplicateOutputRecovery(operation: () => Promise<void>): Promise<void> {
  const result = receiveQueue.then(
    () => runWithDuplicateOutputRecovery(operation),
    () => runWithDuplicateOutputRecovery(operation),
  );
  receiveQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
