import { getEncodedTokenV3 } from '@cashu/cashu-ts';
import { buildHistorySearchIndex, searchHistory } from '~/features/history/historySearch';
import {
  defaultHistoryFilters,
  filterHistory,
  type HistoryListEntry,
} from '~/features/history/historyList';
import { normalizeNpub } from '~/shared/utils/nostr';

const publicKey = 'ab'.repeat(32);
const npub = normalizeNpub(publicKey);
const mintUrl = 'https://mint.example';
const time = new Date(2026, 9, 24, 18, 30).getTime();
const entry = (id: string, changes: Partial<HistoryListEntry> = {}): HistoryListEntry => ({
  id,
  type: 'send',
  amount: 1000,
  unit: 'sat',
  mintUrl,
  createdAt: time,
  ...changes,
});
const context = {
  people: {
    [npub]: { npub, displayName: 'Alice Café', username: 'alice', nip05: 'alice@bey.cash' },
  },
  mints: [{ mintUrl, name: 'Community mint', nickname: 'Spending' }],
};
const ids = (entries: HistoryListEntry[], query: string) =>
  searchHistory(buildHistorySearchIndex(entries, context), query).map((item) => item.id);

it('combines saved contact names and receipt notes across hex and npub identifiers', () => {
  const entries = [
    entry('coffee', {
      metadata: JSON.stringify({ nostrPubkey: publicKey, note: 'Morning coffee' }),
    }),
    entry('dinner', { metadata: { nostrPubkey: npub, memo: 'Dinner' } }),
    entry('unrelated', { metadata: { note: 'Coffee with Bob' } }),
  ];
  expect(ids(entries, ' ALICE cafe COFFEE ')).toEqual(['coffee']);
  expect(ids(entries, 'alice@bey.cash dinner')).toEqual(['dinner']);
  expect(ids(entries, npub)).toEqual(['coffee', 'dinner']);
  expect(ids(entries, 'spending coffee')).toEqual(['coffee', 'unrelated']);
});

it('matches ungrouped, grouped and symbol-prefixed satoshi amounts without numeric substrings', () => {
  const entries = [entry('one-thousand'), entry('ten-thousand', { amount: 10000 })];
  for (const query of ['1000', '1,000 sat', '1 000', '₿1,000']) {
    expect(ids(entries, query)).toEqual(['one-thousand']);
  }
  expect(ids(entries, '10,000')).toEqual(['ten-thousand']);
});

it('matches the local calendar date for both timestamp formats and tolerates invalid dates', () => {
  const entries = [
    entry('milliseconds'),
    entry('seconds', { createdAt: time / 1000 }),
    entry('invalid', { createdAt: NaN }),
  ];
  for (const query of ['2026-10-24', 'Oct 24', 'October 24 2026']) {
    expect(ids(entries, query)).toEqual(['milliseconds', 'seconds']);
  }
});

it('keeps search results compatible with filters, ordering and hidden on-chain address rows', () => {
  const entries = [
    entry('sent', { metadata: { note: 'Coffee' }, createdAt: time - 1000 }),
    entry('received', { type: 'receive', metadata: { note: 'Coffee' } }),
    entry('unused-address', {
      type: 'mint',
      amount: 0,
      metadata: { via: 'onchain', note: 'Coffee' },
    }),
  ];
  const matches = searchHistory(buildHistorySearchIndex(entries, context), 'coffee');
  expect(filterHistory(matches, defaultHistoryFilters).map((item) => item.id)).toEqual([
    'received',
    'sent',
  ]);
  expect(
    filterHistory(matches, { ...defaultHistoryFilters, quick: 'sent' }).map((item) => item.id),
  ).toEqual(['sent']);
});

it('searches token memos without indexing raw tokens, proofs or unrelated private metadata', () => {
  const token = getEncodedTokenV3({
    mint: mintUrl,
    memo: 'Lunch at the park',
    proofs: [
      {
        id: '00' + 'ab'.repeat(7),
        amount: 1000,
        secret: 'synthetic-search-secret',
        C: '02' + '11'.repeat(32),
      },
    ],
  });
  const index = buildHistorySearchIndex(
    [
      entry('memo', { token, metadata: { privateField: 'private-search-fixture' } }),
      entry('broken', { token: 'broken-token', metadata: '{malformed' }),
    ],
    context,
  );
  expect(searchHistory(index, 'lunch park').map((item) => item.id)).toEqual(['memo']);
  for (const query of [
    token,
    'synthetic-search-secret',
    'private-search-fixture',
    'broken-token',
  ]) {
    expect(searchHistory(index, query)).toEqual([]);
  }
  expect(searchHistory(index, '  ')).toHaveLength(2);
});
