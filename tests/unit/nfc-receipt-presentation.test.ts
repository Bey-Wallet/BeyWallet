import {
  historyDisplayAmount,
  nfcReceivingFeeNotice,
} from '~/features/history/transactionPresentation';

const receipt = {
  type: 'receive',
  amount: 8,
  metadata: { via: 'nfc', fee: 1, netAmount: 7, requestedAmount: 8, receivingFeeCovered: false },
};

it('shows the actual credited NFC amount and explains an uncovered receiving fee', () => {
  expect(historyDisplayAmount(receipt)).toBe(7);
  expect(nfcReceivingFeeNotice(receipt)).toBe(
    'The sender did not cover the receiving fee. It was deducted from this payment.',
  );
});

it('shows net value without a warning when the sender covers the receiving fee', () => {
  const covered = {
    ...receipt,
    amount: 9,
    metadata: { ...receipt.metadata, netAmount: 8, receivingFeeCovered: true },
  };
  expect(historyDisplayAmount(covered)).toBe(8);
  expect(nfcReceivingFeeNotice(covered)).toBeUndefined();
});

it('supports persisted JSON metadata and preserves the gross stored receipt', () => {
  const stored = { ...receipt, metadata: JSON.stringify(receipt.metadata) };
  expect(historyDisplayAmount(stored)).toBe(7);
  expect(stored.amount).toBe(8);
});

it.each([
  { ...receipt, type: 'send' },
  { ...receipt, state: 'unclaimed' },
  { ...receipt, metadata: { ...receipt.metadata, netAmount: 100 } },
  { ...receipt, metadata: { ...receipt.metadata, netAmount: 0, fee: 8 } },
  { ...receipt, metadata: { ...receipt.metadata, fee: -1 } },
  { ...receipt, metadata: {} },
])('does not replace other or invalid receipt amounts', (entry) => {
  expect(historyDisplayAmount(entry)).toBe(8);
  expect(nfcReceivingFeeNotice(entry)).toBeUndefined();
});
