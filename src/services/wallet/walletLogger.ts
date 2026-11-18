import type { Logger } from 'coco-cashu-core';
import { recordDiagnosticFailure } from '~/services/feedback/diagnosticFailures';

/** Read only a plain numeric protocol code; never evaluate error getters or messages. */
export function safeMintErrorCode(value: unknown): number | undefined {
  try {
    if (!value || typeof value !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'code');
    const code = descriptor?.value;
    return typeof code === 'number' && Number.isSafeInteger(code) && code >= 0 && code <= 99999
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

/** Diagnose preparation failures without forwarding arbitrary error text or metadata. */
export function safeWalletErrorDiagnostic(value: unknown) {
  const own = (key: string): unknown => {
    try {
      return value && typeof value === 'object'
        ? Object.getOwnPropertyDescriptor(value, key)?.value
        : undefined;
    } catch {
      return undefined;
    }
  };
  const names = [
    'Error',
    'TypeError',
    'RangeError',
    'AggregateError',
    'HttpResponseError',
    'NetworkError',
    'MintOperationError',
    'ProofValidationError',
    'ProofOperationError',
    'KeysetSyncError',
    'MintFetchError',
    'OperationInProgressError',
    'UnknownMintError',
  ];
  const name = own('name');
  const message = own('message');
  const status = own('status');
  const hints = [
    ['proof_reserved', /proof.*already reserved/i],
    ['proof_unavailable', /proof.*(?:not found|not ready)/i],
    ['database_locked', /database (?:is )?locked|SQLITE_BUSY|SQLITE_LOCKED/i],
    ['transaction_conflict', /transaction.*(?:within|already|active)|cannot.*transaction/i],
    ['storage_constraint', /constraint failed|SQLITE_CONSTRAINT/i],
    ['counter', /counter/i],
    ['random_source', /random|entropy/i],
    ['invalid_number', /non-negative|NaN|must be.*(?:number|integer)/i],
    ['mint_response', /HTTP|status code|bad request|server error|response/i],
    ['invoice', /invoice|bolt11/i],
  ] as const;
  return {
    type:
      typeof name === 'string' && names.includes(name)
        ? name
        : value instanceof TypeError
          ? 'TypeError'
          : value instanceof RangeError
            ? 'RangeError'
            : 'Error',
    status:
      typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : undefined,
    code: safeMintErrorCode(value),
    hint:
      typeof message === 'string'
        ? (hints.find(([, pattern]) => pattern.test(message))?.[0] ?? 'unknown')
        : 'unknown',
  };
}

// Exact SDK message allowlist. Metadata is deliberately never inspected.
function traceMeltPreparation(message: string) {
  if (!__DEV__) return;
  const steps: Record<string, string> = {
    'Preparing bolt11 melt operation': 'requesting_quote',
    'Melt quote created': 'quote_created',
    'Proofs selected for melt': 'proofs_selected',
    'Proofs reserved': 'proofs_reserved',
    'Preparing direct melt (no swap)': 'preparing_direct',
    'Preparing swap-then-melt': 'preparing_swap',
    'Swap amounts calculated': 'swap_amounts_ready',
    'Direct melt prepared': 'direct_prepared',
    'Swap-then-melt prepared': 'swap_prepared',
    'Melt operation prepared': 'operation_saved',
  };
  if (Object.prototype.hasOwnProperty.call(steps, message))
    console.log('[CocoMelt]', { step: steps[message] });
}

/** SDK messages and metadata can contain bearer proofs or keys. Never forward them to console. */
export const walletLogger: Logger = {
  error: (message: string, metadata?: unknown) => {
    if (message === 'Mint operation error, not retrying') {
      recordDiagnosticFailure('mint_redeem', metadata);
      console.error('[Coco] Mint rejected issuance; automatic retries stopped.', {
        code: safeMintErrorCode(metadata) ?? 'unavailable',
      });
      return;
    }
    if (
      message.includes('Keyset restore failed') ||
      message.includes('Restore completed with failures') ||
      message === 'WS error' ||
      message.includes('WS request error') ||
      message.includes('Polling task error') ||
      message.includes('Failed to process mint quote') ||
      message.includes('Failed to redeem mint quote') ||
      message.includes('had undefined amount') ||
      message.includes('Quote amount undefined')
    )
      return;
    if (message.includes('Failed to fetch mint info')) {
      recordDiagnosticFailure('mint_connection', metadata);
      console.warn('[Coco] Mint info refresh unavailable.');
      return;
    }
    recordDiagnosticFailure('wallet_sdk', metadata);
    console.error('[Coco] Wallet operation failed.');
  },
  warn: (message: string) => {
    if (
      message.includes('WS request error') ||
      message.includes('Polling task error') ||
      message.includes('had undefined amount') ||
      message.includes('Quote amount undefined') ||
      message.includes('Failed to process mint quote') ||
      message.includes('Failed to redeem mint quote')
    )
      return;
    console.warn('[Coco] Wallet operation warning.');
  },
  info: traceMeltPreparation,
  debug: traceMeltPreparation,
};
