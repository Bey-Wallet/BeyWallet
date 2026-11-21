export const diagnosticOperations = {
  app_runtime: 'App runtime',
  wallet_start: 'Wallet startup',
  wallet_refresh: 'Wallet refresh',
  wallet_sdk: 'Wallet SDK',
  mint_connection: 'Mint connection',
  mint_quote: 'Lightning deposit quote',
  mint_redeem: 'Lightning deposit issuance',
  lightning_prepare: 'Lightning payment preparation',
  lightning_pay: 'Lightning payment submission',
  lightning_status: 'Lightning payment status',
  ecash_receive: 'Ecash receive',
  ecash_send: 'Ecash send',
  mint_transfer: 'Mint transfer',
  settings_action: 'Settings action',
} as const;
export type DiagnosticOperation = keyof typeof diagnosticOperations;
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'NetworkError',
  'HttpResponseError',
  'MintOperationError',
  'ProofValidationError',
  'KeysetSyncError',
  'MintFetchError',
]);
export function diagnosticErrorType(value: unknown): string {
  return typeof value === 'string' && errorTypes.has(value) ? value : 'Error';
}
export interface DiagnosticFailure {
  operation: DiagnosticOperation;
  at: number;
  durationMs?: number;
  type: string;
  code?: number;
  status?: number;
  count: number;
}
const LIMIT = 20;
let failures: DiagnosticFailure[] = [];
// A wallet reset invalidates in-flight observers too, so late errors cannot repopulate the log.
let generation = 0;
export const diagnosticFailureGeneration = () => generation;

function own(value: unknown, key: string): unknown {
  return value && typeof value === 'object'
    ? Object.getOwnPropertyDescriptor(value, key)?.value
    : undefined;
}
function integer(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

/** No messages, stacks, URLs, identifiers or raw metadata are inspected or retained. */
export function recordDiagnosticFailure(
  operation: DiagnosticOperation,
  error: unknown,
  startedAt?: number,
  expectedGeneration = generation,
) {
  try {
    if (
      typeof operation !== 'string' ||
      expectedGeneration !== generation ||
      !Object.prototype.hasOwnProperty.call(diagnosticOperations, operation)
    )
      return;
    const at = Date.now();
    const name = own(error, 'name');
    const type =
      typeof name === 'string'
        ? diagnosticErrorType(name)
        : error instanceof TypeError
          ? 'TypeError'
          : error instanceof RangeError
            ? 'RangeError'
            : 'Error';
    const code = integer(own(error, 'code'), 0, 99999);
    const status = integer(own(error, 'status'), 100, 599);
    const durationMs =
      typeof startedAt === 'number' ? integer(at - startedAt, 0, 86_400_000) : undefined;
    const previous = failures.at(-1);
    if (
      previous &&
      at - previous.at <= 30_000 &&
      previous.operation === operation &&
      previous.type === type &&
      previous.code === code &&
      previous.status === status
    ) {
      failures[failures.length - 1] = {
        operation,
        at,
        durationMs,
        type,
        code,
        status,
        count: Math.min(previous.count + 1, 999),
      };
    } else {
      failures = [
        ...failures.slice(-(LIMIT - 1)),
        { operation, at, durationMs, type, code, status, count: 1 },
      ];
    }
  } catch {
    // Diagnostic collection must never affect payment execution, even for hostile error objects.
  }
}
export function getDiagnosticFailures(): DiagnosticFailure[] {
  return failures.map((failure) => ({ ...failure }));
}
export function clearDiagnosticFailures() {
  generation++;
  failures = [];
}
export async function observeDiagnosticOperation<T>(
  operation: DiagnosticOperation,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const currentGeneration = generation;
  try {
    return await action();
  } catch (error) {
    recordDiagnosticFailure(operation, error, startedAt, currentGeneration);
    throw error;
  }
}
