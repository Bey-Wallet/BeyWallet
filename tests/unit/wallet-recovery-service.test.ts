import { walletService } from '~/services/wallet/walletService';
import { initService } from '~/services/wallet/initService';

const mockGetKeys = jest.fn();
jest.mock('@cashu/cashu-ts', () => ({
  Mint: jest.fn().mockImplementation(() => ({ getKeys: mockGetKeys })),
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: { getManager: jest.fn() },
  purgeCorruptedKeysets: jest.fn(),
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('~/services/wallet/tokenUtils', () => ({}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: { setState: jest.fn() } }));

function setup(failingKeyset?: string) {
  const keysets = [
    { id: 'active', unit: 'sat', active: true, keypairs: { '1': 'loaded-key' } },
    { id: 'inactive', unit: 'SAT', active: false, keypairs: {} },
    { id: 'legacy', unit: '', active: false, keypairs: {} },
    { id: 'sats', unit: 'sats', active: false, keypairs: {} },
    { id: 'usd', unit: 'usd', active: true, keypairs: {} },
  ];
  const saved = {
    balance: 0,
    counters: {} as Record<string, number>,
    proofs: ['protected'],
    history: ['existing-payment'],
  };
  const restoreKeyset = jest.fn(async (_url: string, _wallet: unknown, id: string) => {
    if (id === failingKeyset) throw new Error('synthetic unavailable keyset');
    // The SDK owns saving proofs and advancing counters. The wrapper must call it
    // for every eligible keyset and leave its saved results intact after failures.
    saved.balance += 2;
    saved.counters[id] = 400;
    saved.proofs.push(`recovered:${id}`);
  });
  const manager = {
    keysetRepository: {
      getKeysets: jest.fn().mockResolvedValue(keysets),
      updateKeysetKeys: jest.fn(),
    },
    walletRestoreService: { restoreKeyset, restoreBatchSize: 0, restoreGapLimit: 0 },
    wallet: {
      mintService: { addMintByUrl: jest.fn().mockResolvedValue({ keysets }) },
      walletService: { getWalletWithActiveKeysetId: jest.fn().mockResolvedValue({ wallet: {} }) },
      walletRestoreService: { restoreKeyset },
      restore: jest.fn(),
    },
  };
  jest.mocked(initService.getManager).mockReturnValue(manager as any);
  mockGetKeys.mockResolvedValue({ '1': 'synthetic-key' });
  return { manager, saved, restoreKeyset };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(walletService, 'restoreInflightProofs').mockResolvedValue(0);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('reuses loaded keys and scans active and inactive SAT keysets with the existing gap settings', async () => {
  const { manager, saved, restoreKeyset } = setup();
  const job = walletService.restore('https://mint.test');
  await jest.runAllTimersAsync();
  await expect(job).resolves.toEqual({ partial: false });
  expect(mockGetKeys.mock.calls.map(([id]) => id)).toEqual(['inactive', 'legacy', 'sats']);
  expect(restoreKeyset.mock.calls.map(([, , id]) => id)).toEqual([
    'active',
    'inactive',
    'legacy',
    'sats',
  ]);
  expect(manager.walletRestoreService).toMatchObject({
    restoreBatchSize: 200,
    restoreGapLimit: 200,
  });
  expect(saved).toEqual({
    balance: 8,
    counters: { active: 400, inactive: 400, legacy: 400, sats: 400 },
    proofs: [
      'protected',
      'recovered:active',
      'recovered:inactive',
      'recovered:legacy',
      'recovered:sats',
    ],
    history: ['existing-payment'],
  });
});

it('continues after a keyset failure and retains SDK results, protected proofs and history', async () => {
  const { saved, restoreKeyset } = setup('inactive');
  const job = walletService.restore('https://mint.test');
  await jest.runAllTimersAsync();
  await expect(job).resolves.toEqual({ partial: true });
  expect(restoreKeyset).toHaveBeenCalledTimes(4);
  expect(saved.balance).toBe(6);
  expect(saved.counters).toEqual({ active: 400, legacy: 400, sats: 400 });
  expect(saved.proofs).toContain('protected');
  expect(saved.history).toEqual(['existing-payment']);
  expect(walletService.restoreInflightProofs).toHaveBeenCalledWith('https://mint.test');
});
