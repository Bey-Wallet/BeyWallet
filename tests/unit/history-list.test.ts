import {
  defaultHistoryFilters,
  filterHistory,
  groupHistory,
  historyRail,
  isPendingHistory,
  type HistoryListEntry,
} from '~/features/history/historyList';
import {
  historyBalanceEffect,
  historyStatusLabel,
} from '~/features/history/transactionPresentation';

const now = new Date(2026, 9, 22, 12);

it.each(['failed', 'expired', 'cancelled', 'rolled_back', 'refunded', 'UNPAID'])(
  'does not show a debit for an unsuccessful or reversed outgoing amount (%s)',
  (state) => expect(historyBalanceEffect({ type: 'melt', state })).toBe('none'),
);

it('keeps minted ecash, confirmed onchain deposits, and reserved sends distinct', () => {
  expect(historyBalanceEffect({ type: 'mint', state: 'PAID' })).toBe('none');
  expect(historyBalanceEffect({ type: 'mint', state: 'ISSUED' })).toBe('credit');
  expect(historyBalanceEffect({ type: 'mint', state: 'PAID', metadata: { via: 'onchain' } })).toBe(
    'credit',
  );
  expect(historyBalanceEffect({ type: 'send', state: 'prepared' })).toBe('debit');
  expect(historyBalanceEffect({ type: 'receive', state: 'pending' })).toBe('none');
});

it('keeps ecash creation and delivery distinct from a verified claim', () => {
  const created = { type: 'send', state: 'unclaimed' };
  const delivered = { ...created, metadata: { delivery: 'delivered' } };
  expect(historyStatusLabel(created)).toBe('Created');
  expect(historyStatusLabel(delivered)).toBe('Delivered');
  expect(historyStatusLabel(created, true)).toBe('Delivered');
  expect(historyStatusLabel({ ...delivered, state: 'claimed' })).toBe('Claimed');
  expect(historyStatusLabel({ ...delivered, state: 'refunded' }, true)).toBe('Refunded');
});

it('does not call a paid Lightning deposit confirmed before ecash is issued', () => {
  expect(historyStatusLabel({ type: 'mint', state: 'paid' })).toBe('Awaiting ecash');
  expect(historyStatusLabel({ type: 'mint', state: 'issued' })).toBe('Confirmed');
  expect(historyStatusLabel({ type: 'melt', state: 'paid' })).toBe('Confirmed');
});
const makeEntry = (
  id: string,
  type: string,
  overrides: Partial<HistoryListEntry> = {},
): HistoryListEntry => ({
  id,
  type,
  amount: 100,
  unit: 'sat',
  mintUrl: 'https://mint.example',
  createdAt: now.getTime(),
  ...overrides,
});

it('keeps independent equal-value payments instead of guessing a transfer', () => {
  const receive = makeEntry('receive', 'receive');
  const send = makeEntry('send', 'send', { createdAt: now.getTime() - 1000 });
  expect(filterHistory([send, receive], defaultHistoryFilters, now)).toEqual([receive, send]);
});

it('hides unused onchain addresses while retaining real deposits and submitted sends', () => {
  const entries = [
    makeEntry('address', 'mint', { amount: 0, state: 'pending', metadata: { via: 'onchain' } }),
    makeEntry('received', 'mint', { amount: 120, state: 'paid', metadata: { via: 'onchain' } }),
    makeEntry('sent', 'melt', { amount: 80, state: 'PENDING', metadata: { via: 'onchain' } }),
  ];
  expect(filterHistory(entries, defaultHistoryFilters, now).map((entry) => entry.id)).toEqual([
    'received',
    'sent',
  ]);
  expect(
    filterHistory(entries, { ...defaultHistoryFilters, quick: 'pending' }, now).map(
      (entry) => entry.id,
    ),
  ).toEqual(['sent']);
});

it('filters sent, received and pending without counting requests as received funds', () => {
  const entries = [
    makeEntry('send', 'send', { state: 'pending' }),
    makeEntry('receive', 'receive'),
    makeEntry('request', 'receive-request', { state: 'pending' }),
    makeEntry('melt', 'melt', { state: 'PAID' }),
  ];
  const ids = (quick: 'pending' | 'sent' | 'received') =>
    filterHistory(entries, { ...defaultHistoryFilters, quick }, now).map((entry) => entry.id);
  expect(ids('pending')).toEqual(['send', 'request']);
  expect(ids('sent')).toEqual(['send', 'melt']);
  expect(ids('received')).toEqual(['receive']);
});

it('combines quick, rail, date and mint filters, including second-based timestamps', () => {
  const entries = [
    makeEntry('recent', 'melt', { state: 'PENDING', createdAt: now.getTime() / 1000 }),
    makeEntry('old', 'melt', { state: 'PENDING', createdAt: now.getTime() - 8 * 86400000 }),
    makeEntry('other', 'melt', { state: 'PENDING', mintUrl: 'https://other.example' }),
  ];
  expect(
    filterHistory(
      entries,
      { quick: 'pending', rail: 'lightning', time: 'week', mint: 'https://mint.example/' },
      now,
    ).map((entry) => entry.id),
  ).toEqual(['recent']);
});

it('recognizes explicit transfers, legacy onchain metadata and pending quote states', () => {
  expect(
    historyRail(makeEntry('transfer', 'melt', { metadata: JSON.stringify({ via: 'swap' }) })),
  ).toBe('transfer');
  expect(historyRail(makeEntry('chain', 'mint', { metadata: { via: 'onchain' } }))).toBe('onchain');
  expect(isPendingHistory(makeEntry('paid', 'mint', { state: 'PAID' }))).toBe(true);
  expect(isPendingHistory(makeEntry('issued', 'mint', { state: 'ISSUED' }))).toBe(false);
  expect(isPendingHistory(makeEntry('claimed', 'send', { state: 'finalized' }))).toBe(false);
  expect(isPendingHistory(makeEntry('refunded', 'send', { state: 'rolledBack' }))).toBe(false);
  expect(
    isPendingHistory(makeEntry('chain', 'mint', { state: 'paid', metadata: { via: 'onchain' } })),
  ).toBe(false);
});

it('groups by local calendar date with stable first/last positions', () => {
  const yesterday = new Date(2026, 9, 21, 23).getTime();
  const rows = groupHistory(
    [
      makeEntry('a', 'send'),
      makeEntry('b', 'receive'),
      makeEntry('c', 'send', { createdAt: yesterday / 1000 }),
      makeEntry('d', 'receive', { createdAt: new Date(2026, 9, 20).getTime() }),
      makeEntry('e', 'send', { createdAt: new Date(2025, 11, 1).getTime() }),
    ],
    now,
  );
  expect(rows.filter((row) => row.kind === 'header').map((row) => row.title)).toEqual([
    'Today',
    'Yesterday',
    'Earlier this month',
    'December 2025',
  ]);
  expect(rows.filter((row) => row.kind === 'item').map((row) => row.position)).toEqual([
    'first',
    'last',
    'only',
    'only',
    'only',
  ]);
});
