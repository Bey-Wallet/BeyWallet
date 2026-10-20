import {
  defaultHistoryFilters,
  filterHistory,
  flattenHistory,
  historyGroupTitle,
  historyRowPresentation,
  mergeHistoryTransfers,
  type HistoryListEntry,
} from '~/features/history/historyListModel';

const now = new Date(2026, 0, 1, 12);
const entry = (
  id: string,
  date: Date,
  extra: Partial<HistoryListEntry> = {},
): HistoryListEntry => ({
  id,
  type: 'send',
  amount: 100,
  unit: 'sat',
  mintUrl: 'https://mint.example',
  createdAt: date.getTime(),
  state: 'completed',
  ...extra,
});
const all = defaultHistoryFilters;

it('uses local calendar boundaries and includes years for older months', () => {
  expect(historyGroupTitle(new Date(2026, 0, 1, 0).getTime(), now)).toBe('Today');
  expect(historyGroupTitle(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('Yesterday');
  expect(historyGroupTitle(new Date(2025, 11, 20).getTime(), now)).toMatch(/2025/);
  expect(historyGroupTitle(new Date(2026, 0, 10).getTime(), new Date(2026, 0, 20))).toMatch(
    /January/,
  );
});

it('keeps pending activity in strict date order within date sections', () => {
  const rows = [
    entry('older', new Date(2025, 11, 31), { state: 'pending' }),
    entry('new', new Date(2026, 0, 1, 11)),
    entry('early', new Date(2026, 0, 1, 8)),
  ];
  expect(flattenHistory(filterHistory(rows, all, now), now)).toMatchObject([
    { kind: 'header', title: 'Today' },
    { kind: 'item', entry: { id: 'new' } },
    { kind: 'item', entry: { id: 'early' } },
    { kind: 'header', title: 'Yesterday' },
    { kind: 'item', entry: { id: 'older' } },
  ]);
});

it('combines mint, time and pending filters and resets to all activity', () => {
  const rows = [
    entry('match', now, { mintUrl: 'https://mint.example/', state: 'unpaid' }),
    entry('other', now, { mintUrl: 'https://other.example', state: 'unpaid' }),
    entry('old', new Date(2025, 11, 31), { state: 'unpaid' }),
    entry('done', now),
  ];
  expect(
    filterHistory(
      rows,
      { ...all, mint: 'https://mint.example', time: 'today', direction: 'pending' },
      now,
    ).map((row) => row.id),
  ).toEqual(['match']);
  expect(filterHistory(rows, all, now)).toHaveLength(4);
});

it('keeps transfers and requests out of Sent and Received filters', () => {
  const rows = ['send', 'melt', 'receive', 'mint', 'swap', 'receive-request'].map((type) =>
    entry(type, now, { type }),
  );
  expect(filterHistory(rows, { ...all, direction: 'sent' }, now).map((row) => row.id)).toEqual([
    'send',
    'melt',
  ]);
  expect(filterHistory(rows, { ...all, direction: 'received' }, now).map((row) => row.id)).toEqual([
    'receive',
    'mint',
  ]);
});

it('classifies paired transfers before filtering and retains the original detail identity', () => {
  const rows = [
    entry('incoming', now, { type: 'mint', metadata: '{"via":"lightning"}' }),
    entry('outgoing', new Date(now.getTime() - 1000), { type: 'melt', amount: 102 }),
  ];
  expect(
    filterHistory(mergeHistoryTransfers(rows), { ...all, type: 'transfers' }, now),
  ).toMatchObject([
    {
      id: 'incoming',
      type: 'swap',
      amount: 102,
      metadata: { sourceId: 'outgoing', targetId: 'incoming' },
    },
  ]);
});

it('distinguishes Lightning, on-chain and request activity with string metadata', () => {
  const rows = [
    entry('ln', now, { type: 'mint' }),
    entry('chain', now, { type: 'mint', metadata: '{"via":"onchain"}' }),
    entry('req', now, { type: 'receive-request' }),
  ];
  expect(filterHistory(rows, { ...all, type: 'lightning' }, now).map((row) => row.id)).toEqual([
    'ln',
  ]);
  expect(filterHistory(rows, { ...all, type: 'onchain' }, now).map((row) => row.id)).toEqual([
    'chain',
  ]);
  expect(filterHistory(rows, { ...all, type: 'requests' }, now).map((row) => row.id)).toEqual([
    'req',
  ]);
});

it.each([
  ['send', 'Sent', 'sent', '−'],
  ['melt', 'Sent', 'sent', '−'],
  ['receive', 'Received', 'received', '+'],
  ['mint', 'Received', 'received', '+'],
  ['swap', 'Transfer', 'transfer', ''],
  ['receive-request', 'Payment request', 'request', ''],
])('uses a meaningful title, direction icon and amount sign for %s', (type, title, icon, sign) => {
  expect(historyRowPresentation(entry('1', now, { type }))).toMatchObject({ title, icon, sign });
});

it('shows payment context rather than raw public keys or token metadata', () => {
  expect(historyRowPresentation(entry('1', now, { metadata: { via: 'nfc' } })).subtitle).toBe(
    'Ecash · NFC',
  );
  expect(historyRowPresentation(entry('1', now, { type: 'mint' })).subtitle).toBe('Lightning');
  expect(
    historyRowPresentation(
      entry('1', now, { type: 'swap', metadata: { sourceMintName: 'A', targetMintName: 'B' } }),
    ).subtitle,
  ).toBe('A → B');
});
