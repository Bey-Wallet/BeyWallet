import { decodeNostrPublicKey } from '~/services/api/nostrProfileService';

export interface PersonHistoryEntry {
  id: string;
  type: string;
  amount: number;
  state?: string;
  createdAt: number;
  metadata?: Record<string, unknown> | string | null;
}

export function parsePersonHistoryMetadata(
  metadata: PersonHistoryEntry['metadata'],
): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata !== 'string') return metadata;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function filterPersonHistory(
  entries: PersonHistoryEntry[],
  npub: string,
): PersonHistoryEntry[] {
  const targetPubkey = decodeNostrPublicKey(npub);
  if (!targetPubkey) return [];

  return entries
    .filter((entry) => {
      if (entry.type !== 'send' && entry.type !== 'receive') return false;
      const metadata = parsePersonHistoryMetadata(entry.metadata);
      const historyPubkey =
        typeof metadata.nostrPubkey === 'string'
          ? decodeNostrPublicKey(metadata.nostrPubkey)
          : null;
      return historyPubkey === targetPubkey;
    })
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
}

export function getPersonPaymentStatus(entry: PersonHistoryEntry): string {
  const state = entry.state?.trim().toLowerCase();
  if (state === 'claimed' || state === 'paid' || state === 'completed') return 'Claimed';
  if (state === 'pending' || state === 'unpaid' || state === 'unclaimed') {
    return entry.type === 'send' ? 'Awaiting claim' : 'Pending';
  }
  if (state === 'failed' || state === 'error') return 'Failed';
  if (state === 'expired') return 'Expired';
  if (state === 'refunded') return 'Refunded';
  return entry.type === 'receive' ? 'Received' : 'Sent';
}
