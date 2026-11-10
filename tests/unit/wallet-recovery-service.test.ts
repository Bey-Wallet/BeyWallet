import { walletService } from '~/services/wallet/walletService';
import { restoreMintFromSeed } from '~/services/wallet/seedRecovery';
import { useWalletStore } from '~/state/walletStore';

const mockRefreshBalance = jest.fn(async () => {});

jest.mock('~/services/wallet/seedRecovery', () => ({ restoreMintFromSeed: jest.fn() }));
jest.mock('~/services/wallet/initService', () => ({
  initService: {},
  purgeCorruptedKeysets: jest.fn(),
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('~/services/wallet/tokenUtils', () => ({}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { setState: jest.fn(), getState: () => ({ refreshBalance: mockRefreshBalance }) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('refreshes verified balances without progress writes or releasing reserved proofs', async () => {
  const inflight = jest.spyOn(walletService, 'restoreInflightProofs');
  jest.mocked(restoreMintFromSeed).mockImplementation(async (_url, saved) => {
    await saved();
    return { partial: true };
  });
  await expect(walletService.restore('https://mint.test')).resolves.toEqual({ partial: true });
  expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
  expect(useWalletStore.setState).not.toHaveBeenCalled();
  expect(inflight).not.toHaveBeenCalled();
  inflight.mockRestore();
});

it('propagates a failed scan without refreshing an unverified balance', async () => {
  jest.mocked(restoreMintFromSeed).mockRejectedValueOnce(new Error('Unavailable mint'));
  await expect(walletService.restore('https://mint.test')).rejects.toThrow('Unavailable mint');
  expect(mockRefreshBalance).not.toHaveBeenCalled();
  expect(useWalletStore.setState).not.toHaveBeenCalled();
});
