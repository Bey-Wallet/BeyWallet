import { appLogMessages, type AppLogMessage } from './appLogMessages';
import {
  diagnosticErrorType,
  diagnosticFailureGeneration,
  recordDiagnosticFailure,
  type DiagnosticOperation,
} from '~/services/feedback/diagnosticFailures';

const allowed = new Set<string>(appLogMessages);
type Level = 'debug' | 'warn' | 'error';
type Fields = { type: string; code?: number; status?: number; durationMs?: number; hint?: string };
const hints = new Set([
  'proof_reserved',
  'proof_unavailable',
  'database_locked',
  'transaction_conflict',
  'storage_constraint',
  'counter',
  'random_source',
  'invalid_number',
  'mint_response',
  'invoice',
  'unknown',
]);
const own = (value: unknown, key: string): unknown => {
  try {
    return value && typeof value === 'object'
      ? Object.getOwnPropertyDescriptor(value, key)?.value
      : undefined;
  } catch {
    return undefined;
  }
};
const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : undefined;
function errorType(value: unknown): string {
  const declared = own(value, 'name') ?? own(value, 'type');
  if (declared !== undefined) return diagnosticErrorType(declared);
  try {
    if (value instanceof TypeError) return 'TypeError';
    if (value instanceof RangeError) return 'RangeError';
  } catch {
    // Hostile proxies must not affect the caller.
  }
  return 'Error';
}

/** Never read messages, stacks, causes, getters or serialization hooks. */
export function safeLogFields(error: unknown): Fields {
  const hint = own(error, 'hint');
  return {
    type: errorType(error),
    ...optional('code', integer(own(error, 'code'), 0, 99999)),
    ...optional('status', integer(own(error, 'status'), 100, 599)),
    ...optional(
      'durationMs',
      integer(own(error, 'durationMs') ?? own(error, 'elapsedMs'), 0, 86_400_000),
    ),
    ...(typeof hint === 'string' && hints.has(hint) ? { hint } : {}),
  };
}
function optional(key: string, value: number | undefined) {
  return value === undefined ? {} : { [key]: value };
}

export function createAppLogger({
  development,
  output,
  now = Date.now,
}: {
  development: () => boolean;
  output: (level: Level, message: string, fields?: Fields) => void;
  now?: () => number;
}) {
  const recent = new Map<string, number>();
  let generation = diagnosticFailureGeneration();
  const emit = (
    level: Level,
    message: AppLogMessage,
    error?: unknown,
    operation?: DiagnosticOperation,
  ) => {
    try {
      if (!allowed.has(message)) return;
      if (level === 'debug') {
        if (development()) {
          if (error === undefined) output(level, message);
          else output(level, message, safeLogFields(error));
        }
        return;
      }
      // Preserve diagnostics even when repeated console messages are rate-limited.
      if (generation !== diagnosticFailureGeneration()) {
        generation = diagnosticFailureGeneration();
        recent.clear();
      }
      if (operation) recordDiagnosticFailure(operation, error);
      const fields = error === undefined ? undefined : safeLogFields(error);
      const key = `${level}:${message}:${fields?.type}:${fields?.code}:${fields?.status}`;
      const at = now();
      const previous = recent.get(key);
      if (previous !== undefined && at - previous >= 0 && at - previous < 30_000) return;
      if (recent.size >= 100) recent.delete(recent.keys().next().value!);
      recent.set(key, at);
      output(level, message, fields);
    } catch {
      // Logging must not interfere with startup, payments or recovery.
    }
  };
  return {
    debug: (message: AppLogMessage, fields?: unknown) => emit('debug', message, fields),
    warn: (message: AppLogMessage, error?: unknown, operation?: DiagnosticOperation) =>
      emit('warn', message, error, operation),
    error: (message: AppLogMessage, error?: unknown, operation?: DiagnosticOperation) =>
      emit('error', message, error, operation),
  };
}

export const appLogger = createAppLogger({
  development: () => typeof __DEV__ !== 'undefined' && __DEV__,
  output: (level, message, fields) => {
    const method = level === 'debug' ? 'log' : level;
    if (fields) console[method](message, fields);
    else console[method](message);
  },
});
