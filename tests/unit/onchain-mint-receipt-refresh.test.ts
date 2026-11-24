import { quotesService } from '~/services/wallet/quotesService';

const mockSaveProofs = jest.fn();
const mockSaveHistory = jest.fn();
const mockHistory = jest.fn();
const mockInvalidate = jest.fn();
const mockPrepare = jest.fn();
const mockComplete = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      proofRepository: { saveProofs: mockSaveProofs },
      historyRepository: {
        updateHistoryMintEntry: mockSaveHistory,
        getMintHistoryEntry: mockHistory,
      },
    }),
  },
}));
jest.mock('~/shared/utils/queryClient', () => ({
  queryClient: { invalidateQueries: (...args: unknown[]) => mockInvalidate(...args) },
}));
jest.mock('@cashu/cashu-ts', () => ({
  Mint: jest.fn(),
  Wallet: jest.fn(() => ({
    loadMint: async () => {},
    prepareMint: mockPrepare,
    completeMint: mockComplete,
  })),
}));
jest.mock('~/services/feedback/feedbackCoordinator', () => ({
  publishWalletFeedback: jest.fn(),
  quoteFeedbackId: () => 'quote-reference',
}));
jest.mock('~/shared/utils/appLogger', () => ({ appLogger: { warn: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveProofs.mockResolvedValue(undefined);
  mockSaveHistory.mockResolvedValue(undefined);
  mockHistory.mockResolvedValue({ id: 'receipt', createdAt: 1 });
  mockInvalidate.mockResolvedValue(undefined);
  mockPrepare.mockResolvedValue({});
  mockComplete.mockResolvedValue([{ amount: 21 }]);
  jest.spyOn(quotesService, 'checkOnchainMintQuote').mockResolvedValue({
    quote: 'quote',
    request: 'address',
    state: 'PAID',
    amount_paid: 21,
    amount_issued: 0,
    expiry: 0,
    unit: 'sat',
  });
});
afterEach(() => jest.restoreAllMocks());

it('refreshes History and open receipts only after proofs and completion are saved', async () => {
  let finishHistory!: () => void;
  mockSaveHistory.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishHistory = resolve;
    }),
  );
  const received = quotesService.redeemOnchainMintQuote(
    'https://mint.test',
    'quote',
    'fixture-key',
  );
  // Reach the history save without completing it.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(mockSaveProofs).toHaveBeenCalledTimes(1);
  expect(mockSaveHistory).toHaveBeenCalledTimes(1);
  expect(mockInvalidate).not.toHaveBeenCalled();
  finishHistory();
  await received;
  expect(mockInvalidate.mock.calls).toEqual([
    [{ queryKey: ['history'] }],
    [{ queryKey: ['transaction'] }],
  ]);
});

it('never refreshes a completed receipt when proof persistence fails', async () => {
  mockSaveProofs.mockRejectedValueOnce(new Error('Storage failed'));
  await expect(
    quotesService.redeemOnchainMintQuote('https://mint.test', 'quote', 'fixture-key'),
  ).rejects.toThrow('Storage failed');
  expect(mockSaveHistory).not.toHaveBeenCalled();
  expect(mockInvalidate).not.toHaveBeenCalled();
});
