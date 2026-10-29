import {
  createWalletActivity,
  mergeWalletActivity,
  recordRecoveryActivity,
  getWalletActivities,
  saveWalletActivity,
} from '~/services/wallet/walletActivityService';
import { filterHistory, defaultHistoryFilters } from '~/features/history/historyList';

const mockSave = jest.fn();
const mockList = jest.fn();
const mockSend = jest.fn();
const mockReceipt = jest.fn();
let mockSession: any = null;
jest.mock('~/state/recoverySessionStore', () => ({
  useRecoverySessionStore: { getState: () => ({ session: mockSession }) },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'public-random-id' }));
jest.mock('~/services/feedback/feedbackCoordinator', () => ({
  feedbackCoordinator: { wallet: 'wallet-one' },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({ db: {}, historyRepository: { getSendHistoryEntry: mockSend } }),
  },
}));
jest.mock('~/storage/sqlite/repositories/WalletActivityRepository', () => ({
  WalletActivityRepository: jest
    .fn()
    .mockImplementation(() => ({ save: mockSave, list: mockList })),
}));
jest.mock('~/services/wallet/nostrReceiptService', () => ({
  findTokenReceiveReceipt: (...args: unknown[]) => mockReceipt(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockSession = null;
});

it('groups only exact optimization operation and receipt identities, even when hidden', () => {
  const activity = {
    ...createWalletActivity('optimize', 'https://mint.test/'),
    operationId: 'one',
    receiveHistoryId: 'receipt',
  };
  const payments = [
    { id: 'internal', type: 'send', operationId: 'one', mintUrl: 'https://mint.test', amount: 32 },
    { id: 'receipt', type: 'receive', mintUrl: 'https://mint.test', amount: 32 },
    { id: 'unrelated', type: 'send', operationId: 'two', mintUrl: 'https://mint.test', amount: 32 },
    {
      id: 'other-mint',
      type: 'send',
      operationId: 'one',
      mintUrl: 'https://other.test',
      amount: 32,
    },
  ];
  expect(mergeWalletActivity(payments, [activity]).map((e) => e.id)).toEqual([
    'unrelated',
    'other-mint',
    activity.id,
  ]);
  expect(mergeWalletActivity(payments, [{ ...activity, hidden: true }]).map((e) => e.id)).toEqual([
    'unrelated',
    'other-mint',
  ]);
});

it('requires a saved matching receive before resolving an uncertain optimization', async () => {
  const activity = {
    ...createWalletActivity('optimize', 'https://mint.test'),
    state: 'review' as const,
    operationId: 'one',
  };
  mockList.mockResolvedValue([activity]);
  mockSend.mockResolvedValue({ token: 'local-token', state: 'finalized' });
  mockReceipt.mockResolvedValue(undefined);
  expect((await getWalletActivities())[0].state).toBe('review');
  expect(mockSave).not.toHaveBeenCalled();
  mockReceipt.mockResolvedValue({ id: 'verified-receipt' });
  expect((await getWalletActivities())[0]).toMatchObject({
    state: 'completed',
    receiveHistoryId: 'verified-receipt',
    fee: null,
    balanceDelta: null,
  });
  expect(mockReceipt).toHaveBeenCalledWith('local-token');
});

it('records partial recovery as review without turning existing balances into income', async () => {
  const session = {
    walletId: 'wallet-one',
    feedbackId: 'batch-one',
    selected: ['https://a.test', 'https://b.test'],
    phase: 'interrupted' as const,
    results: [
      { mintUrl: 'https://a.test', status: 'done' as const, balance: 100 },
      { mintUrl: 'https://b.test', status: 'interrupted' as const, balance: 0 },
    ],
  };
  await recordRecoveryActivity(session);
  expect(mockSave).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: 'activity:recovery:batch-one',
      state: 'review',
      completedCount: 1,
      totalCount: 2,
      observedBalance: 100,
      balanceDelta: null,
    }),
  );
  await recordRecoveryActivity({
    ...session,
    phase: 'results',
    results: [
      { mintUrl: 'https://a.test', status: 'done', balance: 100 },
      { mintUrl: 'https://b.test', status: 'done', balance: 5 },
    ],
  });
  expect(mockSave).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: 'activity:recovery:batch-one',
      state: 'completed',
      observedBalance: 105,
    }),
  );
});

it('ignores late writes from an obsolete wallet and does not fail a payment on summary errors', async () => {
  await saveWalletActivity({ ...createWalletActivity('optimize', ''), walletId: 'old-wallet' });
  expect(mockSave).not.toHaveBeenCalled();
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSave.mockRejectedValue(new Error('synthetic-private-error'));
  await expect(saveWalletActivity(createWalletActivity('optimize', ''))).resolves.toBeUndefined();
  expect(warning).toHaveBeenCalledWith('[WalletActivity] Could not save local activity summary.');
  warning.mockRestore();
});

it('separates maintenance from payments and supports recovery mint filters', () => {
  const activity = {
    ...createWalletActivity('recovery', ''),
    mintUrls: ['https://a.test', 'https://b.test'],
  };
  const entries = mergeWalletActivity(
    [
      {
        id: 'payment',
        type: 'receive',
        mintUrl: 'https://a.test',
        amount: 10,
        unit: 'sat',
        createdAt: Date.now(),
      },
    ],
    [activity],
  );
  expect(
    filterHistory(entries, { ...defaultHistoryFilters, rail: 'payments' }).map((e) => e.id),
  ).toEqual(['payment']);
  expect(
    filterHistory(entries, {
      ...defaultHistoryFilters,
      rail: 'maintenance',
      mint: 'https://b.test',
    }).map((e) => e.id),
  ).toEqual([activity.id]);
  expect(
    filterHistory(entries, { ...defaultHistoryFilters, quick: 'received' }).map((e) => e.id),
  ).toEqual(['payment']);
});

it('retains grouping links when an old parent is outside the visible activity window', () => {
  const payment = { id: 'receipt', type: 'receive', mintUrl: 'https://mint.test' };
  expect(
    mergeWalletActivity(
      [payment],
      [],
      [{ mintUrl: 'https://mint.test', operationId: 'old-operation', receiveHistoryId: 'receipt' }],
    ),
  ).toEqual([]);
});

it('refreshes an interrupted recovery from its saved session after restart without replaying work', async () => {
  const activity = createWalletActivity('recovery', '', 'activity:recovery:batch-one');
  mockList.mockResolvedValue([activity]);
  mockSession = {
    walletId: 'wallet-one',
    feedbackId: 'batch-one',
    selected: ['https://a.test', 'https://b.test'],
    phase: 'interrupted',
    results: [
      { mintUrl: 'https://a.test', status: 'done', balance: 100 },
      { mintUrl: 'https://b.test', status: 'interrupted', balance: 0 },
    ],
  };
  expect((await getWalletActivities())[0]).toMatchObject({
    state: 'review',
    completedCount: 1,
    totalCount: 2,
    observedBalance: 100,
    balanceDelta: null,
  });
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockReceipt).not.toHaveBeenCalled();
});
