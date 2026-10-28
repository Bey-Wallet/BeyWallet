import { Wallet, getEncodedTokenV3 } from '@cashu/cashu-ts';
import { checkHistoryStatus } from '~/features/history/checkHistoryStatus';
import { proofService } from '~/services/wallet/proofService';
import { quotesService } from '~/services/wallet/quotesService';
import type { HistoryListEntry } from '~/features/history/historyList';

const mockUpdate = jest.fn();
const mockMintCheck = jest.fn();
const mockMeltCheck = jest.fn();
jest.mock('@cashu/cashu-ts', () => ({
  ...jest.requireActual('@cashu/cashu-ts'),
  Wallet: jest.fn().mockImplementation(() => ({
    checkMintQuoteBolt11: mockMintCheck,
    checkMeltQuoteBolt11: mockMeltCheck,
  })),
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: { getRepo: () => ({ historyRepository: { updateHistoryEntryState: mockUpdate } }) },
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { checkProofStates: jest.fn() },
}));
jest.mock('~/services/wallet/quotesService', () => ({
  quotesService: {
    checkOnchainMintQuote: jest.fn(),
    checkOnchainMeltQuote: jest.fn(),
    redeemMintQuote: jest.fn(),
  },
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: { getState: () => ({ loadPendingRequests: jest.fn(), requests: [] }) },
}));
const token = getEncodedTokenV3({
  mint: 'https://mint.example',
  proofs: [1, 2].map((amount) => ({
    amount,
    id: '00' + 'ab'.repeat(7),
    secret: `synthetic-${amount}`,
    C: '02' + '11'.repeat(32),
  })),
});
const entry: HistoryListEntry = {
  id: '1',
  type: 'send',
  amount: 3,
  mintUrl: 'https://mint.example',
  unit: 'sat',
  createdAt: 1,
  token,
};
beforeEach(() => {
  jest.clearAllMocks();
});

it.each([
  { states: [] },
  { states: [{ state: 'SPENT' }] },
  { states: [{ state: 'SPENT' }, { state: 'UNSPENT' }] },
])('does not mark a partially verified token as claimed (%j)', async ({ states }) => {
  jest.mocked(proofService.checkProofStates).mockResolvedValue(states as any);
  await expect(checkHistoryStatus(entry)).rejects.toThrow();
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('updates only an outgoing token after every proof is confirmed spent', async () => {
  jest
    .mocked(proofService.checkProofStates)
    .mockResolvedValue([{ state: 'SPENT' }, { state: 'SPENT' }] as any);
  await expect(checkHistoryStatus(entry)).resolves.toBe('Ecash claimed');
  expect(mockUpdate).toHaveBeenCalledWith('1', 'claimed');
  mockUpdate.mockClear();
  await checkHistoryStatus({ ...entry, type: 'receive' });
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('leaves unspent and pending tokens unchanged', async () => {
  jest
    .mocked(proofService.checkProofStates)
    .mockResolvedValue([{ state: 'UNSPENT' }, { state: 'UNSPENT' }] as any);
  await expect(checkHistoryStatus(entry)).resolves.toBe('Ecash not claimed');
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('checks Lightning quotes without redeeming or marking funds received', async () => {
  mockMintCheck.mockResolvedValue({ state: 'PAID' });
  await expect(checkHistoryStatus({ ...entry, type: 'mint', quoteId: 'quote' })).resolves.toBe(
    'Payment paid',
  );
  expect(Wallet).toHaveBeenCalledWith(entry.mintUrl);
  expect(mockMintCheck).toHaveBeenCalledWith('quote');
  expect(quotesService.redeemMintQuote).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('uses the onchain status endpoint for onchain payments', async () => {
  jest.mocked(quotesService.checkOnchainMeltQuote).mockResolvedValue({ state: 'PENDING' });
  await expect(
    checkHistoryStatus({ ...entry, type: 'melt', quoteId: 'quote', metadata: { via: 'onchain' } }),
  ).resolves.toBe('Payment pending');
  expect(quotesService.checkOnchainMeltQuote).toHaveBeenCalledWith(entry.mintUrl, 'quote');
  expect(mockMeltCheck).not.toHaveBeenCalled();
});
