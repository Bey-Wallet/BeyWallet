import { walletService } from '~/services/wallet/walletService';
import { initService } from '~/services/wallet/initService';

jest.mock('~/services/wallet/initService', () => ({
  initService: { getManager: jest.fn(), getRepo: jest.fn() },
  purgeCorruptedKeysets: jest.fn(),
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'test-fixture',
    getNostrKeys: async () => ({ pubkey: 'b'.repeat(64) }),
  },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({ encodeToken: () => 'complete-token' }));
jest.mock('~/services/wallet/cashuReceiveRecovery', () => ({}));
jest.mock('~/services/wallet/cashuReceiveKeysets', () => ({}));
jest.mock('@cashu/cashu-ts', () => ({}));

const recipient = '02' + 'a'.repeat(64);
function setup() {
  const inputs = [{ secret: 'input', amount: 64 }];
  const wallet = {
    prepareSwapToSend: jest
      .fn()
      .mockResolvedValue({ payload: { inputs, outputs: [{ amount: 62 }] } }),
    completeSwap: jest
      .fn()
      .mockResolvedValue({ keep: [{ secret: 'change' }], send: [{ secret: 'locked' }] }),
  };
  const proofService = {
    reserveProofs: jest.fn(),
    releaseProofs: jest.fn(),
    saveProofs: jest.fn(),
    setProofState: jest.fn(),
  };
  const historyRepository = { addHistoryEntry: jest.fn() };
  const manager = {
    mintService: { isTrustedMint: async () => true },
    mint: { getMintInfo: jest.fn().mockResolvedValue({ nuts: { 11: { supported: true } } }) },
    walletService: { getWalletWithActiveKeysetId: async () => ({ wallet }) },
    proofRepository: { getAvailableProofs: async () => inputs },
    proofService,
  };
  (initService.getManager as jest.Mock).mockReturnValue(manager);
  (initService.getRepo as jest.Mock).mockReturnValue({ historyRepository });
  return { wallet, proofService, manager, historyRepository };
}

it('prepares SDK lock/refund conditions without swapping and releases selected inputs', async () => {
  const { wallet, proofService } = setup();
  const deadline = Date.now() + 3600000;
  const review = await walletService.prepareP2PK('https://mint.test', 50, recipient, deadline);
  expect(review.fee).toBe(2);
  expect(wallet.prepareSwapToSend).toHaveBeenCalledWith(
    50,
    expect.any(Array),
    { includeFees: true },
    {
      send: {
        type: 'p2pk',
        options: {
          pubkey: recipient,
          locktime: Math.ceil(deadline / 1000),
          refundKeys: ['02' + 'b'.repeat(64)],
        },
      },
      keep: { type: 'random' },
    },
  );
  expect(wallet.completeSwap).not.toHaveBeenCalled();
  await review.dispose();
  expect(proofService.releaseProofs).toHaveBeenCalledWith('https://mint.test', ['input']);
  await expect(review.execute()).rejects.toThrow('replaced');
});

it('executes a prepared swap once and persists public refund metadata and the actual fee', async () => {
  const { wallet, historyRepository } = setup();
  const deadline = Date.now() + 3600000;
  const review = await walletService.prepareP2PK('https://mint.test', 50, recipient, deadline);
  await Promise.all([review.execute(), review.execute()]);
  expect(wallet.completeSwap).toHaveBeenCalledTimes(1);
  expect(historyRepository.addHistoryEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      metadata: {
        type: 'p2pk',
        p2pkPubkey: recipient,
        fee: 2,
        reclaimAt: deadline,
        refundPubkey: '02' + 'b'.repeat(64),
      },
    }),
  );
});

it('rejects unknown mint capabilities before reserving or swapping proofs', async () => {
  const { manager, proofService, wallet } = setup();
  manager.mint.getMintInfo.mockResolvedValue({ nuts: {} });
  await expect(
    walletService.prepareP2PK('https://mint.test', 50, recipient, Date.now() + 100000),
  ).rejects.toThrow('support');
  expect(proofService.reserveProofs).not.toHaveBeenCalled();
  expect(wallet.completeSwap).not.toHaveBeenCalled();
});
