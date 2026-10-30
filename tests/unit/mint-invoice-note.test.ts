import { Wallet } from '@cashu/cashu-ts';
import { quotesService } from '~/services/wallet/quotesService';
const mockCreateInvoice = jest.fn();
const mockSupportsDescription = jest.fn();
const mockTrusted = jest.fn();
const mockStoredQuote = jest.fn();
const mockNormalQuote = jest.fn();
const mockAddQuote = jest.fn();
const mockMintInfo = { nuts: {} };
jest.mock('@cashu/cashu-ts', () => ({
  Wallet: jest.fn().mockImplementation(() => ({
    getMintInfo: () => ({ supportsNut04Description: mockSupportsDescription }),
    createMintQuoteBolt11: mockCreateInvoice,
  })),
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
  mockSupportsDescription.mockReturnValue(true);
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
  expect(await quotesService.createMintQuote('mint', 64, ' Coffee ')).toBe(quote);
  expect(mockTrusted).toHaveBeenCalledWith('mint');
  expect(mockCreateInvoice).toHaveBeenCalledWith(64, 'Coffee');
  expect(mockAddQuote).toHaveBeenCalledWith('mint', [quote]);
  expect(mockNormalQuote).not.toHaveBeenCalled();
});
it('silently uses normal invoice creation when descriptions are unsupported', async () => {
  mockSupportsDescription.mockReturnValue(false);
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
