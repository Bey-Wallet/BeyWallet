import { buildShareableReceipt } from '~/features/history/shareableReceipt';

const entry = {
  id: 'private-id',
  type: 'send' as const,
  state: 'unclaimed',
  amount: 1234,
  unit: 'sat',
  createdAt: Date.now(),
  mintUrl: 'https://mint.example',
};
it('exports an explicit public field allowlist and keeps unclaimed ecash pending', () => {
  const summary = buildShareableReceipt({
    ...entry,
    token: 'private-token',
    quoteId: 'private-quote',
    metadata: {
      note: 'private-note',
      npub: 'private-identity',
      address: 'private-address',
      invoice: 'private-invoice',
    },
  } as any)!;
  expect(Object.keys(summary).sort()).toEqual([
    'amount',
    'date',
    'direction',
    'method',
    'mint',
    'sats',
    'status',
    'type',
  ]);
  expect(summary).toMatchObject({
    amount: '₿ 1,234',
    direction: 'Sent',
    method: 'Ecash',
    status: 'Pending',
  });
  expect(JSON.stringify(summary)).not.toContain('private');
});
it.each([
  ['mint', 'PAID', 'Pending'],
  ['mint', 'ISSUED', 'Confirmed'],
  ['send', 'claimed', 'Confirmed'],
  ['melt', 'pending', 'Pending'],
  ['send', 'failed', 'Failed'],
  ['send', 'expired', 'Expired'],
  ['send', 'cancelled', 'Cancelled'],
  ['send', 'unknown', 'Pending'],
] as const)('labels %s %s accurately', (type, state, status) => {
  expect(buildShareableReceipt({ ...entry, type, state })?.status).toBe(status);
});
it('keeps unfinished transfers pending and uses confirmed completion only', () => {
  const transfer = { ...entry, state: 'paid', metadata: { transferId: 'private-transfer' } };
  expect(buildShareableReceipt(transfer, { transferState: 'executing' })).toMatchObject({
    method: 'Transfer',
    status: 'Pending',
  });
  expect(buildShareableReceipt(transfer, { transferState: 'completed' })?.status).toBe('Confirmed');
});
it('respects the symbol preference and shows a verified reclaim as refunded', () => {
  expect(buildShareableReceipt(entry, { bitcoinSymbol: false, reclaimed: true })).toMatchObject({
    amount: '1,234 sat',
    status: 'Refunded',
  });
});

it('includes only payable public request/invoice QRs, never spendable ecash', () => {
  const invoice = 'lnbc1000synthetic';
  const request = 'creqAcHVibGlj';
  expect(buildShareableReceipt({ ...entry, type: 'mint', state: 'UNPAID' }, { invoice })?.qr).toBe(
    invoice,
  );
  expect(
    buildShareableReceipt({ ...entry, type: 'mint', state: 'PAID' }, { invoice })?.qr,
  ).toBeUndefined();
  expect(
    buildShareableReceipt({ ...entry, type: 'mint', state: 'UNPAID' }, { invoice, expired: true })
      ?.qr,
  ).toBeUndefined();
  expect(
    buildShareableReceipt({ ...entry, type: 'receive-request', state: 'pending' }, { request })?.qr,
  ).toBe(request);
  expect(
    buildShareableReceipt({ ...entry, type: 'receive-request', state: 'received' }, { request })
      ?.qr,
  ).toBeUndefined();
  expect(
    buildShareableReceipt(entry, { request: 'cashuAspendable', invoice: 'cashuAspendable' })?.qr,
  ).toBeUndefined();
});

it('shows a mint name or public origin without URL credentials or private parameters', () => {
  const mint = {
    ...entry,
    mintUrl: 'https://user:password@mint.example/private-path?token=private-key#secret',
  };
  expect(buildShareableReceipt(mint)?.mint).toBe('https://mint.example');
  expect(buildShareableReceipt(mint, { mintName: 'Example mint' })?.mint).toBe('Example mint');
});
it.each([
  { amount: NaN },
  { amount: -1 },
  { amount: 1.5 },
  { unit: 'unknown' },
  { createdAt: NaN },
])('rejects invalid public amounts or dates: %s', (changes) => {
  expect(buildShareableReceipt({ ...entry, ...changes })).toBeNull();
});
