import { consolidationService } from '~/services/wallet/consolidationService';
import { walletService } from '~/services/wallet/walletService';
import { proofService } from '~/services/wallet/proofService';
import { saveWalletActivity } from '~/services/wallet/walletActivityService';

const mockHistory = jest.fn();
jest.mock('~/services/wallet/walletService', () => ({
  walletService: { send: jest.fn(), receive: jest.fn() },
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { getReadyProofs: jest.fn() },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: { getRepo: () => ({ historyRepository: { addHistoryEntry: mockHistory } }) },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({
  decodeToken: () => ({ amount: 32, raw: 'recoverable-token' }),
}));
jest.mock('~/services/wallet/walletActivityService', () => ({
  createWalletActivity: () => ({
    id: 'activity-one',
    state: 'pending',
    fee: null,
    balanceDelta: null,
  }),
  saveWalletActivity: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(proofService.getReadyProofs)
    .mockResolvedValueOnce(Array.from({ length: 8 }, () => ({ amount: 4 }) as any))
    .mockResolvedValue([{ amount: 64 }] as any);
  jest
    .mocked(walletService.send)
    .mockResolvedValue({ id: 'operation-one', token: 'original-token' } as any);
  jest.mocked(walletService.receive).mockResolvedValue(undefined);
  jest.mocked(saveWalletActivity).mockResolvedValue(undefined);
});

it('records success only after receive and never guesses fees from changed wallet totals', async () => {
  await consolidationService.consolidateMint('https://mint.test');
  expect(walletService.send).toHaveBeenCalledWith('https://mint.test', 32);
  expect(walletService.receive).toHaveBeenCalledWith('original-token');
  expect(saveWalletActivity).toHaveBeenLastCalledWith(
    expect.objectContaining({
      state: 'completed',
      operationId: 'operation-one',
      beforeCount: 8,
      afterCount: 1,
      fee: null,
      balanceDelta: null,
    }),
  );
  expect(jest.mocked(saveWalletActivity).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(walletService.send).mock.invocationCallOrder[0],
  );
  expect(jest.mocked(saveWalletActivity).mock.invocationCallOrder[2]).toBeGreaterThan(
    jest.mocked(walletService.receive).mock.invocationCallOrder[0],
  );
});

it('keeps the existing recoverable intermediate token when receive is uncertain', async () => {
  jest.mocked(walletService.receive).mockRejectedValueOnce(new Error('network unavailable'));
  await expect(consolidationService.consolidateMint('https://mint.test')).rejects.toThrow(
    'send succeeded',
  );
  expect(saveWalletActivity).toHaveBeenLastCalledWith(
    expect.objectContaining({ state: 'review', operationId: 'operation-one' }),
  );
  expect(mockHistory).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'send',
      state: 'unclaimed',
      token: 'recoverable-token',
      operationId: 'operation-one',
    }),
  );
  expect(walletService.send).toHaveBeenCalledTimes(1);
});

it('does not call receive or report success when send has an unknown outcome', async () => {
  jest.mocked(walletService.send).mockRejectedValueOnce(new Error('timeout'));
  await expect(consolidationService.consolidateMint('https://mint.test')).rejects.toThrow(
    'timeout',
  );
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(saveWalletActivity).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'review' }));
});
