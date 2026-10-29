import { bech32 } from 'bech32';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  buildReceiptDetails,
  invoiceDisplayDetails,
  needsFullScreenReceipt,
} from '~/features/history/receiptDetails';

const entry = {
  id: 'entry',
  type: 'melt',
  amount: 21,
  unit: 'sat',
  mintUrl: 'https://mint.test',
  createdAt: 1,
  state: 'paid',
  quoteId: 'quote',
};
it.each(['paid', 'completed', 'finalized', 'refunded', 'failed', 'expired', 'cancelled'])(
  'uses a receipt sheet for terminal %s payments',
  (state) => {
    expect(needsFullScreenReceipt({ ...entry, state })).toBe(false);
  },
);
it.each(['pending', 'unpaid', 'unclaimed', 'executing', 'unresolved', 'unknown', undefined])(
  'keeps %s payments full screen',
  (state) => {
    expect(needsFullScreenReceipt({ ...entry, state })).toBe(true);
  },
);
it('keeps paid-but-unissued top-ups and review-needed receipts full screen', () => {
  expect(needsFullScreenReceipt({ ...entry, type: 'mint', state: 'paid' })).toBe(true);
  expect(
    needsFullScreenReceipt({ ...entry, state: 'failed', metadata: { needsReview: true } }),
  ).toBe(true);
  expect(needsFullScreenReceipt({ ...entry, type: 'receive', state: undefined })).toBe(false);
});
it('uses the overall Transfer outcome to select its presentation', () => {
  const transfer = { ...entry, metadata: { transferId: 'transfer' } };
  expect(needsFullScreenReceipt(transfer)).toBe(true);
  expect(needsFullScreenReceipt(transfer, 'committed')).toBe(true);
  expect(needsFullScreenReceipt(transfer, 'completed')).toBe(false);
  expect(needsFullScreenReceipt(transfer, 'failed')).toBe(false);
});

const tag = (type: number, bytes: Uint8Array) => {
  const data = bech32.toWords(bytes);
  return [type, data.length >> 5, data.length & 31, ...data];
};
function invoice(fields: number[]) {
  // Synthetic metadata fixture only; never submitted as a signed payment request.
  return bech32.encode('lnbc210n', [...Array(7).fill(0), ...fields, ...Array(104).fill(0)], 20000);
}
it('reads descriptions, hashes and expiry without treating invoice metadata as payment evidence', () => {
  const request = invoice([
    ...tag(13, new TextEncoder().encode('Coffee')),
    ...tag(1, new Uint8Array(32).fill(1)),
  ]);
  expect(invoiceDisplayDetails(request.toUpperCase())).toMatchObject({
    description: 'Coffee',
    paymentHash: '01'.repeat(32),
    expiry: 3600,
  });
  expect(buildReceiptDetails({ ...entry, state: 'pending' }, { request }).status).toBe('Pending');
  expect(buildReceiptDetails({ ...entry, state: undefined }, { request }).status).toBe(
    'Unverified',
  );
});
it('only exposes a payment proof matching the invoice hash', () => {
  const preimage = new Uint8Array(32).fill(7);
  const request = invoice(tag(1, sha256(preimage)));
  const valid = buildReceiptDetails(entry, { request, payment_preimage: bytesToHex(preimage) });
  expect(valid.extra.find((field) => field.label === 'Payment proof')?.copyValue).toBe(
    bytesToHex(preimage),
  );
  const invalid = buildReceiptDetails(entry, { request, payment_preimage: '00'.repeat(32) });
  expect(invalid.extra.some((field) => field.label === 'Payment proof')).toBe(false);
});
it('does not invent descriptions for hashed-description invoices or malformed inputs', () => {
  const request = invoice([
    ...tag(13, new TextEncoder().encode('Do not display')),
    ...tag(23, new Uint8Array(32)),
  ]);
  expect(invoiceDisplayDetails(request).description).toBeUndefined();
  expect(invoiceDisplayDetails('lnbc-malformed')).toEqual({});
  expect(invoiceDisplayDetails('x'.repeat(20001))).toEqual({});
});
it('does not promote a paid mint quote to received ecash', () => {
  expect(buildReceiptDetails({ ...entry, type: 'mint' }).status).toBe('Awaiting ecash');
});
it('allowlists technical fields without exporting keys, proofs or spendable ecash', () => {
  const detail = buildReceiptDetails(
    {
      ...entry,
      type: 'send',
      metadata: {
        privKey: 'PRIVATE',
        inputs: [{ secret: 'PROOF' }],
        token: 'SPENDABLE',
        note: 'Lunch',
      },
    },
    { fee_reserve: 3 },
  );
  expect(JSON.stringify(detail.extra)).not.toMatch(/PRIVATE|PROOF|SPENDABLE/);
  expect(detail.extra.find((field) => field.label === 'Maximum fee')?.value).toBe('3 sat');
  expect(detail.extra.some((field) => field.label === 'Payment proof')).toBe(false);
});
it('separates on-chain addresses and Transfer references from Lightning invoices', () => {
  const onchain = buildReceiptDetails({
    ...entry,
    metadata: { via: 'onchain', address: 'bc1-example' },
  });
  expect(onchain.method).toBe('Bitcoin on-chain');
  expect(onchain.address).toBe('bc1-example');
  expect(onchain.extra.some((field) => field.label === 'Invoice')).toBe(false);
  const transfer = buildReceiptDetails(
    { ...entry, metadata: { transferId: 'transfer' } },
    { payment_preimage: 'ab'.repeat(32) },
  );
  expect(transfer.method).toBe('Transfer');
  expect(transfer.extra.some((field) => field.label === 'Payment proof')).toBe(false);
});
