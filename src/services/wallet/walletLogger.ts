import type { Logger } from 'coco-cashu-core';

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

/** SDK messages and metadata can contain bearer proofs or keys. Never forward them to console. */
export const walletLogger: Logger = {
  error: (message: string, metadata?: unknown) => {
    if (message === 'Mint operation error, not retrying') {
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
      console.warn('[Coco] Mint info refresh unavailable.');
      return;
    }
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
  info: () => {},
  debug: () => {},
};
