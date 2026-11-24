import { historyMetadata, isOnchainHistory } from './transactionPresentation';
import type { PosOrigin } from '~/storage/sqlite/repositories/PosRepository';

export type HistoryScope = 'all' | 'wallet' | 'pos';

export function scopeHistory(
  entries: HistoryListEntry[],
  scope: HistoryScope,
  origins: PosOrigin[],
) {
  const originKey = (kind: string, mintUrl: string, reference: string) =>
    JSON.stringify([kind, mintUrl.replace(/\/+$/, ''), reference]);
  const keys = new Map(
    origins.map((origin) => [originKey(origin.kind, origin.mintUrl, origin.reference), origin]),
  );
  const groups = new Map<string, HistoryListEntry[]>();
  const projected = entries.map((entry) => {
    const kind = entry.type === 'mint' ? 'quote' : 'request';
    const reference =
      entry.type === 'mint'
        ? entry.quoteId
        : entry.type === 'receive-request'
          ? entry.id
          : entry.type === 'receive'
            ? historyMetadata(entry).requestId
            : undefined;
    const key = typeof reference === 'string' ? originKey(kind, entry.mintUrl, reference) : '';
    const origin = keys.get(key);
    if (!origin) return { entry, pos: false };
    const tagged = { ...entry, metadata: { ...historyMetadata(entry), pos: true } };
    const groupKey = origin.saleId ? `sale:${origin.saleId}` : key;
    const group = groups.get(groupKey) || [];
    group.push(tagged);
    groups.set(groupKey, group);
    return { entry: tagged, pos: true };
  });
  const retained = new Set<HistoryListEntry>();
  for (const group of groups.values()) {
    // Hide unused checkout offers, never separate payments actually received.
    const receipts = group.filter((entry) =>
      entry.type === 'receive'
        ? ![
            'failed',
            'error',
            'expired',
            'cancelled',
            'canceled',
            'rolled_back',
            'rolledback',
          ].includes(entry.state?.toLowerCase() || '')
        : entry.type === 'mint' &&
          ['paid', 'issued', 'completed', 'received', 'confirmed'].includes(
            entry.state?.toLowerCase() || '',
          ),
    );
    if (receipts.length) receipts.forEach((entry) => retained.add(entry));
    else {
      const representative = [...group].sort(
        (a, b) =>
          Number(isPendingHistory(b)) - Number(isPendingHistory(a)) ||
          historyTimestamp(b.createdAt) - historyTimestamp(a.createdAt),
      )[0];
      retained.add(representative);
    }
  }
  return projected
    .filter(({ entry, pos }) => (pos ? scope !== 'wallet' && retained.has(entry) : scope !== 'pos'))
    .map(({ entry }) => entry);
}

export interface HistoryListEntry {
  id: string;
  type: string;
  amount: number;
  unit: string;
  mintUrl: string;
  state?: string;
  createdAt: number;
  metadata?: unknown;
  token?: unknown;
  quoteId?: string;
  operationId?: string;
  paymentRequest?: string;
}

export type QuickFilter = 'all' | 'pending' | 'sent' | 'received';
export interface HistoryFilters {
  quick: QuickFilter;
  rail: string;
  time: string;
  mint: string;
}
export const defaultHistoryFilters: HistoryFilters = {
  quick: 'all',
  rail: 'all',
  time: 'all',
  mint: 'all',
};

export function historyTimestamp(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}

export function isPendingHistory(
  entry: Pick<HistoryListEntry, 'type' | 'state' | 'metadata' | 'paymentRequest'>,
): boolean {
  const state = entry.state?.toLowerCase() || '';
  if (entry.type === 'maintenance') return ['pending', 'review'].includes(state);
  return (
    ['pending', 'unpaid', 'unclaimed', 'prepared', 'executing', 'preparing', 'unresolved'].includes(
      state,
    ) ||
    (entry.type === 'mint' && state === 'paid' && !isOnchainHistory(entry))
  );
}

export function historyRail(entry: HistoryListEntry): string {
  if (entry.type === 'maintenance') return 'maintenance';
  if (entry.type === 'swap' || historyMetadata(entry).via === 'swap') return 'transfer';
  if (entry.type === 'receive-request') return 'requests';
  if (isOnchainHistory(entry)) return 'onchain';
  return ['mint', 'melt'].includes(entry.type) ? 'lightning' : 'ecash';
}

export function filterHistory(
  entries: HistoryListEntry[],
  filters: HistoryFilters,
  now = new Date(),
) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const cutoff =
    filters.time === 'today'
      ? today
      : filters.time === 'week'
        ? now.getTime() - 7 * 86400000
        : filters.time === 'month'
          ? now.getTime() - 30 * 86400000
          : 0;
  return entries
    .filter((entry) => {
      const targetMint = historyMetadata(entry).targetMintUrl;
      const activityMints = historyMetadata(entry).walletActivity?.mintUrls;
      // Address creation is persisted for recovery, but is not payment activity.
      if (isOnchainHistory(entry) && !(entry.amount > 0)) return false;
      if (
        filters.mint !== 'all' &&
        entry.mintUrl.replace(/\/$/, '') !== filters.mint.replace(/\/$/, '') &&
        !(
          Array.isArray(activityMints) &&
          activityMints.some(
            (url: unknown) =>
              typeof url === 'string' && url.replace(/\/$/, '') === filters.mint.replace(/\/$/, ''),
          )
        ) &&
        !(
          historyRail(entry) === 'transfer' &&
          typeof targetMint === 'string' &&
          targetMint.replace(/\/$/, '') === filters.mint.replace(/\/$/, '')
        )
      )
        return false;
      if (historyTimestamp(entry.createdAt) < cutoff) return false;
      if (filters.rail === 'payments') {
        if (['maintenance', 'requests'].includes(historyRail(entry))) return false;
      } else if (filters.rail !== 'all' && historyRail(entry) !== filters.rail) return false;
      if (filters.quick === 'pending') return isPendingHistory(entry);
      if (filters.quick === 'sent')
        return ['send', 'melt'].includes(entry.type) && historyRail(entry) !== 'transfer';
      if (filters.quick === 'received')
        return ['receive', 'mint'].includes(entry.type) && historyRail(entry) !== 'transfer';
      return true;
    })
    .sort((a, b) => historyTimestamp(b.createdAt) - historyTimestamp(a.createdAt));
}

export type HistoryListRow =
  | { kind: 'header'; title: string }
  | { kind: 'item'; entry: HistoryListEntry; position: 'first' | 'middle' | 'last' | 'only' };

export function groupHistory(entries: HistoryListEntry[], now = new Date()): HistoryListRow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const groups = new Map<string, HistoryListEntry[]>();
  for (const entry of entries) {
    const date = new Date(historyTimestamp(entry.createdAt));
    if (!Number.isFinite(date.getTime())) continue;
    const title =
      date >= today
        ? 'Today'
        : date >= yesterday
          ? 'Yesterday'
          : date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
            ? 'Earlier this month'
            : date.toLocaleDateString('en-US', {
                month: 'long',
                ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
              });
    const items = groups.get(title) || [];
    items.push(entry);
    groups.set(title, items);
  }
  return Array.from(groups).flatMap(([title, items]): HistoryListRow[] => [
    { kind: 'header', title },
    ...items.map((entry, index): HistoryListRow => ({
      kind: 'item',
      entry,
      position:
        items.length === 1
          ? 'only'
          : index === 0
            ? 'first'
            : index === items.length - 1
              ? 'last'
              : 'middle',
    })),
  ]);
}
