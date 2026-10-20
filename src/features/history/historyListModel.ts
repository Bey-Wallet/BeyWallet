import { historyMetadata, isOnchainHistory } from './transactionPresentation';

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
  paymentRequest?: string;
}

export const historyDirections = [
  ['all', 'All'],
  ['sent', 'Sent'],
  ['received', 'Received'],
  ['pending', 'Pending'],
] as const;
export const historyTypes = [
  ['all', 'All types'],
  ['ecash', 'Ecash'],
  ['lightning', 'Lightning'],
  ['onchain', 'On-chain'],
  ['transfers', 'Transfers'],
  ['requests', 'Requests'],
] as const;
export const historyTimes = [
  ['all', 'All time'],
  ['today', 'Today'],
  ['3days', 'Last 3 days'],
  ['week', 'Last 7 days'],
  ['month', 'Last 30 days'],
] as const;
export const defaultHistoryFilters = { direction: 'all', mint: 'all', time: 'all', type: 'all' };
export type HistoryFilters = typeof defaultHistoryFilters;

export function isHistoryPending(state?: string) {
  return ['pending', 'unpaid', 'unclaimed', 'prepared'].includes(
    (state || '').trim().toLowerCase(),
  );
}

export function historyGroupTitle(createdAt: number, now = new Date()) {
  const date = new Date(createdAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function historyRowTime(createdAt: number, now = new Date()) {
  const recent = ['Today', 'Yesterday'].includes(historyGroupTitle(createdAt, now));
  const date = new Date(createdAt);
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return recent
    ? time
    : `${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'short' })}, ${time}`;
}

export function historyRowPresentation(entry: HistoryListEntry) {
  const metadata = historyMetadata(entry);
  const outgoing = ['send', 'melt'].includes(entry.type);
  const transfer = entry.type === 'swap';
  const request = entry.type === 'receive-request';
  const title = transfer
    ? 'Transfer'
    : request
      ? 'Payment request'
      : outgoing
        ? 'Sent'
        : ['receive', 'mint'].includes(entry.type)
          ? 'Received'
          : 'Activity';
  const rail = isOnchainHistory(entry)
    ? 'On-chain'
    : ['mint', 'melt'].includes(entry.type) || metadata.via === 'lightning'
      ? 'Lightning'
      : 'Ecash';
  const via = metadata.via === 'nfc' ? 'NFC' : metadata.via === 'nostr' ? 'Nostr' : undefined;
  const contact = typeof metadata.nostrUsername === 'string' ? metadata.nostrUsername : undefined;
  const transferLabel =
    metadata.sourceMintName && metadata.targetMintName
      ? `${metadata.sourceMintName} → ${metadata.targetMintName}`
      : 'Between mints';
  return {
    title,
    icon: transfer
      ? 'transfer'
      : request
        ? 'request'
        : outgoing
          ? 'sent'
          : title === 'Received'
            ? 'received'
            : 'activity',
    subtitle: transfer
      ? transferLabel
      : request
        ? 'Awaiting payment'
        : [rail, contact || via].filter(Boolean).join(' · '),
    sign: transfer || request ? '' : outgoing ? '−' : title === 'Received' ? '+' : '',
  };
}

export function filterHistory(
  entries: HistoryListEntry[],
  filters: HistoryFilters,
  now = new Date(),
) {
  const dayCounts: Record<string, number> = { '3days': 3, week: 7, month: 30 };
  const days = dayCounts[filters.time];
  const cutoff =
    filters.time === 'today'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      : days
        ? now.getTime() - days * 86400000
        : 0;
  return entries
    .filter((entry) => {
      if (
        filters.mint !== 'all' &&
        entry.mintUrl.replace(/\/$/, '') !== filters.mint.replace(/\/$/, '')
      )
        return false;
      if (entry.createdAt < cutoff) return false;
      if (filters.direction === 'sent' && !['send', 'melt'].includes(entry.type)) return false;
      if (filters.direction === 'received' && !['receive', 'mint'].includes(entry.type))
        return false;
      if (filters.direction === 'pending' && !isHistoryPending(entry.state)) return false;
      switch (filters.type) {
        case 'ecash':
          return entry.type === 'send' || entry.type === 'receive';
        case 'lightning':
          return ['mint', 'melt'].includes(entry.type) && !isOnchainHistory(entry);
        case 'onchain':
          return isOnchainHistory(entry);
        case 'transfers':
          return entry.type === 'swap';
        case 'requests':
          return entry.type === 'receive-request';
        default:
          return true;
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Retain the existing transfer heuristic, classifying before filters so Transfers is selectable.
export function mergeHistoryTransfers(entries: HistoryListEntry[]) {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const merged: HistoryListEntry[] = [];
  const skipIds = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (skipIds.has(current.id)) continue;
    let match: HistoryListEntry | undefined;
    if (current.type === 'receive' || current.type === 'mint') {
      match = sorted.slice(i + 1, i + 4).find((older) => {
        const difference = Math.abs(current.amount - older.amount);
        return (
          !skipIds.has(older.id) &&
          ['send', 'melt'].includes(older.type) &&
          Math.abs(current.createdAt - older.createdAt) < 60000 &&
          (difference === 0 || (older.type === 'melt' && difference <= older.amount * 0.05))
        );
      });
    }
    if (match) {
      skipIds.add(match.id);
      merged.push({
        ...current,
        type: 'swap',
        amount: match.amount,
        metadata: { ...historyMetadata(current), sourceId: match.id, targetId: current.id },
      });
    } else merged.push(current);
  }
  return merged;
}

export type HistoryFlatItem =
  { kind: 'header'; title: string } | { kind: 'item'; entry: HistoryListEntry };
export function flattenHistory(entries: HistoryListEntry[], now = new Date()): HistoryFlatItem[] {
  const groups: { title: string; entries: HistoryListEntry[] }[] = [];
  for (const entry of entries) {
    if (!Number.isFinite(entry.createdAt)) continue;
    const title = historyGroupTitle(entry.createdAt, now);
    if (groups[groups.length - 1]?.title !== title) groups.push({ title, entries: [] });
    groups[groups.length - 1].entries.push(entry);
  }
  return groups.flatMap(({ title, entries: rows }): HistoryFlatItem[] => [
    { kind: 'header', title },
    ...rows.map((entry): HistoryFlatItem => ({
      kind: 'item',
      entry,
    })),
  ]);
}
