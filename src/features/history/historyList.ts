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

export function historyMintUrls(entry: HistoryListEntry): string[] {
  const { targetMintUrl, walletActivity } = historyMetadata(entry);
  const urls = [entry.mintUrl];
  if (typeof targetMintUrl === 'string' && historyRail(entry) === 'transfer') {
    urls.push(targetMintUrl);
  }
  if (Array.isArray(walletActivity?.mintUrls)) urls.push(...walletActivity.mintUrls);
  return urls
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map((url) => url.replace(/\/+$/, ''));
}

export function filterHistory(
  entries: HistoryListEntry[],
  filters: HistoryFilters,
  now = new Date(),
) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const mint = filters.mint.replace(/\/+$/, '');
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
      // Address creation is persisted for recovery, but is not payment activity.
      if (isOnchainHistory(entry) && !(entry.amount > 0)) return false;
      if (mint !== 'all' && !historyMintUrls(entry).includes(mint)) return false;
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
