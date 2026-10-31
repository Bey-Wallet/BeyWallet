import type { Person } from '~/state/peopleStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import { historyRail, historyTimestamp, type HistoryListEntry } from './historyList';
import { getTransactionNotes } from './transactionNotes';
import {
  historyDisplayAmount,
  historyMetadata,
  historyStatusLabel,
} from './transactionPresentation';
import { walletActivityTitle } from './walletActivityPresentation';

type SearchContext = {
  people: Readonly<Record<string, Pick<Person, 'npub' | 'displayName' | 'username' | 'nip05'>>>;
  mints: ReadonlyArray<{ mintUrl: string; name?: string; nickname?: string }>;
};
export type HistorySearchIndex = Array<{ entry: HistoryListEntry; text: string }>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/(\d)\s(?=\d{3}(?:\D|$))/g, '$1')
    .replace(/[,₿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const mintKey = (url: string) => url.replace(/\/+$/, '');

/** Index only user-facing receipt fields. Raw tokens, proofs, and credentials are excluded. */
export function buildHistorySearchIndex(
  entries: HistoryListEntry[],
  context: SearchContext,
): HistorySearchIndex {
  const people = new Map(
    Object.values(context.people).map((person) => [normalizeNpub(person.npub), person]),
  );
  const mints = new Map(context.mints.map((mint) => [mintKey(mint.mintUrl), mint]));

  return entries.map((entry) => {
    const metadata = historyMetadata(entry);
    const snapshot = metadata.quoteSnapshot;
    const activity = metadata.walletActivity;
    const fields = [
      historyRail(entry),
      historyRail(entry) === 'onchain' ? 'bitcoin' : '',
      ['send', 'melt'].includes(entry.type) ? 'sent' : '',
      ['receive', 'mint'].includes(entry.type) ? 'received' : '',
      entry.type === 'receive-request' ? 'payment request' : '',
      historyStatusLabel(entry),
      ...getTransactionNotes(entry).map((note) => note.value),
      text(metadata.nostrUsername),
      text(metadata.nostrPubkey),
      text(metadata.recipient),
      text(metadata.lnAddress),
      text(snapshot?.recipient),
    ];

    for (const key of [metadata.nostrPubkey, metadata.recipient, snapshot?.recipient]) {
      if (typeof key !== 'string') continue;
      const person = people.get(normalizeNpub(key));
      if (person)
        fields.push(
          person.npub,
          person.displayName || '',
          person.username || '',
          person.nip05 || '',
        );
    }
    const urls = [
      entry.mintUrl,
      text(metadata.targetMintUrl),
      ...(Array.isArray(activity?.mintUrls)
        ? activity.mintUrls.filter((url: unknown) => typeof url === 'string')
        : []),
    ];
    for (const url of urls) {
      const mint = mints.get(mintKey(url));
      fields.push(url, mint?.name || '', mint?.nickname || '');
    }

    const amount =
      entry.type === 'maintenance'
        ? Number.isSafeInteger(activity?.balanceDelta)
          ? Math.abs(activity.balanceDelta)
          : undefined
        : historyDisplayAmount(entry);
    if (amount !== undefined)
      fields.push(String(amount), amount.toLocaleString('en-US'), entry.unit, 'sats', '₿');
    if (
      entry.type === 'maintenance' &&
      ['get-change', 'optimize', 'recovery'].includes(activity?.kind)
    )
      fields.push(walletActivityTitle(activity));

    const date = new Date(historyTimestamp(entry.createdAt));
    if (Number.isFinite(date.getTime())) {
      fields.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      );
    }
    return { entry, text: normalize(fields.join(' ')) };
  });
}

export function searchHistory(index: HistorySearchIndex, query: string): HistoryListEntry[] {
  const terms = normalize(query)
    .split(' ')
    .filter(Boolean)
    .map((term) => (/^\d+$/.test(term) ? new RegExp(`(^|[^0-9])${term}([^0-9]|$)`) : term));
  return index
    .filter((item) =>
      terms.every((term) =>
        typeof term === 'string' ? item.text.includes(term) : term.test(item.text),
      ),
    )
    .map((item) => item.entry);
}
