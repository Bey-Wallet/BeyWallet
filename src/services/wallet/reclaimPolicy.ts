import type { P2PKOptions } from '@cashu/cashu-ts';

export const RECLAIM_PRESETS = [
  { label: 'Off', hours: 0 },
  { label: '1 hour', hours: 1 },
  { label: '6 hours', hours: 6 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
] as const;

export function supportsReclaim(info: unknown): boolean {
  return (
    (info as { nuts?: Record<string, { supported?: boolean }> } | null)?.nuts?.['11']?.supported ===
    true
  );
}

export function reclaimOptions(
  pubkey: string,
  reclaimAt?: number,
  refundPubkey?: string,
  now = Date.now(),
): P2PKOptions {
  if (reclaimAt === undefined) return { pubkey };
  if (!Number.isSafeInteger(reclaimAt) || reclaimAt <= now)
    throw new Error('Reclaim deadline must be in the future');
  if (!refundPubkey || !/^(02|03)[a-f0-9]{64}$/i.test(refundPubkey))
    throw new Error('Invalid refund public key');
  return { pubkey, locktime: Math.ceil(reclaimAt / 1000), refundKeys: [refundPubkey] };
}
