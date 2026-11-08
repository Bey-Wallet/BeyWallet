import { readConversationPaymentStatus } from '~/features/people/conversationPaymentStatus';
import type { ConversationActivity } from '~/features/people/conversationActivity';
import { quotesService } from '~/services/wallet/quotesService';
import { checkHistoryStatus } from '~/features/history/checkHistoryStatus';

const mockMint = jest.fn();
const mockMelt = jest.fn();
const mockCheckMelt = jest.fn();
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      mintQuoteRepository: { findByRequest: mockMint },
      meltQuoteRepository: { findByRequest: mockMelt },
    }),
  },
}));
jest.mock('~/services/wallet/quotesService', () => ({
  quotesService: { checkMintQuote: jest.fn() },
}));
jest.mock('~/features/history/checkHistoryStatus', () => ({ checkHistoryStatus: jest.fn() }));
jest.mock('@cashu/cashu-ts', () => ({
  Wallet: jest.fn().mockImplementation(() => ({ checkMeltQuoteBolt11: mockCheckMelt })),
}));

const invoice: ConversationActivity = {
  id: 'invoice',
  kind: 'payment',
  direction: 'outgoing',
  time: 1,
  status: 'Sent to relay',
  requiresAction: false,
  paymentInput: { value: 'lnbc100n1invoice', route: 'lightning', type: 'Lightning · Invoice' },
};
beforeEach(() => {
  jest.clearAllMocks();
  mockMint.mockResolvedValue(null);
  mockMelt.mockResolvedValue(null);
});

it('does not check invoices that have no locally saved quote', async () => {
  expect(await readConversationPaymentStatus(invoice, [])).toBeUndefined();
  expect(quotesService.checkMintQuote).not.toHaveBeenCalled();
  expect(mockCheckMelt).not.toHaveBeenCalled();
});
it.each([
  ['UNPAID', 'Awaiting payment'],
  ['PAID', 'Paid'],
  ['ISSUED', 'Received'],
])('uses verified mint state %s', async (state, label) => {
  mockMint.mockResolvedValue({ mintUrl: 'https://mint.test', quote: 'q', state: 'UNPAID' });
  jest.mocked(quotesService.checkMintQuote).mockResolvedValue({ state } as any);
  expect(await readConversationPaymentStatus(invoice, [])).toBe(label);
  expect(quotesService.checkMintQuote).toHaveBeenCalledWith('https://mint.test', 'q');
});
it('reads an already issued local quote without a network call', async () => {
  mockMint.mockResolvedValue({ state: 'ISSUED' });
  expect(await readConversationPaymentStatus(invoice, [])).toBe('Received');
  expect(quotesService.checkMintQuote).not.toHaveBeenCalled();
});
it('only expires a verified unpaid quote', async () => {
  mockMint.mockResolvedValue({ state: 'UNPAID', expiry: 1 });
  jest.mocked(quotesService.checkMintQuote).mockResolvedValue({ state: 'UNPAID' } as any);
  expect(await readConversationPaymentStatus(invoice, [])).toBe('Expired');
  jest.mocked(quotesService.checkMintQuote).mockResolvedValue({ state: 'PAID' } as any);
  expect(await readConversationPaymentStatus(invoice, [])).toBe('Paid');
});
it('updates an incoming invoice after this wallet pays it', async () => {
  mockMelt.mockResolvedValue({ mintUrl: 'https://mint.test', quote: 'm', state: 'PENDING' });
  mockCheckMelt.mockResolvedValue({ state: 'PAID' });
  expect(await readConversationPaymentStatus({ ...invoice, direction: 'incoming' }, [])).toBe(
    'Paid',
  );
});
it('matches a structured ecash message to its saved send, even when history is deduplicated', async () => {
  const entry = {
    id: 'send',
    type: 'send',
    amount: 1,
    createdAt: 1,
    mintUrl: 'https://mint.test',
    metadata: { nostrEventId: 'event' },
  };
  jest.mocked(checkHistoryStatus).mockResolvedValue('Ecash claimed');
  const item = {
    ...invoice,
    paymentInput: undefined,
    message: { paymentId: 'event' },
  } as ConversationActivity;
  expect(await readConversationPaymentStatus(item, [entry])).toBe('Claimed');
  expect(checkHistoryStatus).toHaveBeenCalledWith({ ...entry, unit: 'sat' });
});
it('does not turn incomplete proof responses or failed checks into a successful payment', async () => {
  jest.mocked(checkHistoryStatus).mockRejectedValue(new Error('Incomplete status response'));
  const item = {
    ...invoice,
    history: { id: 's', type: 'send', amount: 1, createdAt: 1, mintUrl: 'https://mint.test' },
  };
  await expect(readConversationPaymentStatus(item, [])).rejects.toThrow('Incomplete');
});
it('does not poll a send already recorded as claimed', async () => {
  const item = {
    ...invoice,
    history: {
      id: 's',
      type: 'send',
      amount: 1,
      createdAt: 1,
      mintUrl: 'https://mint.test',
      state: 'claimed',
    },
  };
  expect(await readConversationPaymentStatus(item, [])).toBe('Claimed');
  expect(checkHistoryStatus).not.toHaveBeenCalled();
});
