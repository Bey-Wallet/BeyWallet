import { readPaymentReceiptContext } from '~/services/wallet/paymentReceiptContext';

const mockGet = jest.fn();
const mockQuote = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: { getRepo: () => ({ db: { get: mockGet } }) },
}));
jest.mock('~/services/wallet/lightningReceiptContext', () => ({
  readLightningReceiptSnapshot: (...args: unknown[]) => mockQuote(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  mockQuote.mockReset().mockResolvedValue({});
});

it('reads an exact saved receipt and operation without selecting bearer/signing material', async () => {
  mockGet
    .mockResolvedValueOnce({
      id: 7,
      type: 'melt',
      amount: 21,
      unit: 'sat',
      mintUrl: 'https://mint',
      createdAt: 123,
      state: 'PAID',
      quoteId: 'quote',
      operationId: 'operation',
      paymentRequest: 'invoice',
      tokenJson: 'SPENDABLE',
      metadata: JSON.stringify({ fee: 1, privateKey: 'PRIVATE', inputs: ['PROOF'] }),
    })
    .mockResolvedValueOnce({
      id: 'operation',
      state: 'finalized',
      quoteId: 'quote',
      amount: 21,
      fee_reserve: 3,
      swap_fee: 1,
    });
  mockQuote.mockResolvedValue({ request: 'invoice', amount: 21, state: 'PAID' });
  const context = await readPaymentReceiptContext({
    wallet: 'wallet',
    mintUrl: 'https://mint/',
    type: 'melt',
    quoteId: 'quote',
  });
  expect(context.entry).toMatchObject({
    id: '7',
    createdAt: 123,
    operationId: 'operation',
    metadata: { fee: 1 },
  });
  expect(context.snapshot).toMatchObject({
    operationId: 'operation',
    operationState: 'finalized',
    state: 'PAID',
    fee_reserve: 3,
    swapFee: 1,
  });
  expect(mockGet.mock.calls[0][1]).toEqual(['https://mint', 'https://mint/', 'melt', 'quote']);
  expect(mockGet.mock.calls[1][1]).toEqual(['https://mint', 'https://mint/', 'operation']);
  expect(mockGet.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(
    /tokenJson|inputProof|methodData|OutputData/,
  );
  expect(JSON.stringify(context)).not.toMatch(/SPENDABLE|PRIVATE|PROOF/);
});

it('never substitutes another transaction when an exact reference is missing', async () => {
  const context = await readPaymentReceiptContext({
    wallet: 'wallet',
    mintUrl: 'mint',
    type: 'send',
  });
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockQuote).not.toHaveBeenCalled();
  expect(context.entry).toBeUndefined();
});

it('keeps missing data unavailable during shutdown and never calls a network manager', async () => {
  mockGet.mockRejectedValue(new Error('database closed'));
  mockQuote.mockResolvedValue({});
  const context = await readPaymentReceiptContext({
    wallet: 'wallet',
    mintUrl: 'mint',
    type: 'melt',
    quoteId: 'quote',
  });
  expect(context.entry).toBeUndefined();
  expect(context.snapshot.fee_reserve).toBeUndefined();
});

it('keeps operation state distinct from quote state when only operation data exists', async () => {
  mockGet
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: 'operation', state: 'pending', amount: 5, fee_reserve: 2 });
  const { snapshot } = await readPaymentReceiptContext({
    wallet: 'wallet',
    mintUrl: 'mint',
    type: 'melt',
    operationId: 'operation',
  });
  expect(snapshot.operationState).toBe('pending');
  expect(snapshot.state).toBeUndefined();
  expect(snapshot.amount).toBe(5);
});
