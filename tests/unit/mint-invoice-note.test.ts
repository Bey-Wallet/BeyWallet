import { Wallet } from '@cashu/cashu-ts';
import { quotesService } from '~/services/wallet/quotesService';
const mockCreateInvoice = jest.fn();
const mockTrusted = jest.fn();
const mockStoredQuote = jest.fn();
const mockNormalQuote = jest.fn();
const mockAddQuote = jest.fn();
const mockMintInfo = {
  nuts: { 4: { methods: [{ method: 'bolt11', unit: 'sat', options: { description: true } }] } },
};
jest.mock('@cashu/cashu-ts', () => ({
  ...jest.requireActual('@cashu/cashu-ts'),
  Wallet: jest.fn(() => {
    throw new Error('Invoice creation must not use an uninitialized Wallet');
  }),
  Mint: jest.fn().mockImplementation(() => ({ createMintQuoteBolt11: mockCreateInvoice })),
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getManager: () => ({
      mint: { isTrustedMint: mockTrusted, getMintInfo: async () => mockMintInfo },
      quotes: { createMintQuote: mockNormalQuote, addMintQuote: mockAddQuote },
    }),
    getRepo: () => ({ mintQuoteRepository: { getMintQuote: mockStoredQuote } }),
  },
}));
jest.mock('~/services/feedback/feedbackCoordinator', () => ({
  publishWalletFeedback: jest.fn(),
  quoteFeedbackId: jest.fn(),
}));
const quote = {
  quote: 'quote-id',
  request: 'lnbc-invoice',
  amount: 64,
  unit: 'sat',
  state: 'UNPAID',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockTrusted.mockResolvedValue(true);
  mockMintInfo.nuts[4].methods[0].options.description = true;
  mockCreateInvoice.mockResolvedValue(quote);
  mockNormalQuote.mockResolvedValue(quote);
  mockAddQuote.mockResolvedValue({ added: ['quote-id'], skipped: [] });
  mockStoredQuote.mockResolvedValue(null);
});
it('retains normal Coco creation for invoices without a note', async () => {
  expect(await quotesService.createMintQuote('mint', 64)).toBe(quote);
  expect(mockNormalQuote).toHaveBeenCalledWith('mint', 64);
  expect(Wallet).not.toHaveBeenCalled();
});
it('adds a supported note at invoice creation and registers the quote for normal processing', async () => {
  expect(await quotesService.createMintQuote('mint', 64, ' Coffee ')).toEqual(quote);
  expect(mockTrusted).toHaveBeenCalledWith('mint');
  expect(mockCreateInvoice).toHaveBeenCalledWith({
    amount: 64,
    unit: 'sat',
    description: 'Coffee',
  });
  expect(Wallet).not.toHaveBeenCalled();
  expect(mockAddQuote).toHaveBeenCalledWith('mint', [quote]);
  expect(mockNormalQuote).not.toHaveBeenCalled();
});
it('silently uses normal invoice creation when descriptions are unsupported', async () => {
  mockMintInfo.nuts[4].methods[0].options.description = false;
  expect(await quotesService.createMintQuote('mint', 64, 'Coffee')).toBe(quote);
  expect(mockNormalQuote).toHaveBeenCalledWith('mint', 64);
  expect(mockCreateInvoice).not.toHaveBeenCalled();
  expect(mockAddQuote).not.toHaveBeenCalled();
});
it('rejects an untrusted mint before creating an invoice', async () => {
  mockTrusted.mockResolvedValue(false);
  await expect(quotesService.createMintQuote('mint', 64, 'Coffee')).rejects.toThrow(
    'Mint is not trusted',
  );
  expect(mockCreateInvoice).not.toHaveBeenCalled();
  expect(mockNormalQuote).not.toHaveBeenCalled();
});
it('does not expose an invoice that could not be saved', async () => {
  mockAddQuote.mockResolvedValue({ added: [], skipped: ['quote-id'] });
  await expect(quotesService.createMintQuote('mint', 64, 'Coffee')).rejects.toThrow(
    'Could not save the invoice',
  );
});

it('preserves the requested amount and unit when an older response omits them', async () => {
  mockCreateInvoice.mockResolvedValue({ ...quote, amount: undefined, unit: undefined });
  expect(await quotesService.createMintQuote('mint', 64, 'Coffee')).toEqual(quote);
  expect(mockAddQuote).toHaveBeenCalledWith('mint', [quote]);
});
