import { walletService } from '~/services/wallet/walletService';
import { initService } from '~/services/wallet/initService';
import type { OutputDataLike, SwapPreview } from '@cashu/cashu-ts';
import { npubEncode } from 'nostr-tools/nip19';

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
  const inputs = [{ id: 'keyset', C: 'signature', secret: 'input', amount: 64 }];
  const unselected = { id: 'keyset', C: 'signature', secret: 'unselected', amount: 8 };
  const output = (amount: number): OutputDataLike => ({
    blindedMessage: { amount, id: 'keyset', B_: 'blinded' },
    blindingFactor: 1n,
    secret: new Uint8Array(),
    toProof: jest.fn(),
  });
  const preview: SwapPreview = {
    amount: 50,
    fees: 2,
    keysetId: 'keyset',
    inputs,
    sendOutputs: [output(32), output(16), output(2)],
    keepOutputs: [output(8), output(4)],
    unselectedProofs: [unselected],
  };
  const wallet = {
    prepareSwapToSend: jest.fn().mockResolvedValue(preview),
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
    proofRepository: { getAvailableProofs: async () => [...inputs, unselected] },
    proofService,
  };
  (initService.getManager as jest.Mock).mockReturnValue(manager);
  (initService.getRepo as jest.Mock).mockReturnValue({ historyRepository });
  return { wallet, proofService, manager, historyRepository, preview };
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
  expect(proofService.reserveProofs).toHaveBeenCalledWith(
    'https://mint.test',
    ['input'],
    expect.any(String),
  );
  await review.dispose();
  expect(proofService.releaseProofs).toHaveBeenCalledWith('https://mint.test', ['input']);
  await expect(review.execute()).rejects.toThrow('replaced');
});

it('executes a prepared swap once and persists public refund metadata and the actual fee', async () => {
  const { wallet, historyRepository, proofService, preview } = setup();
  const deadline = Date.now() + 3600000;
  const review = await walletService.prepareP2PK('https://mint.test', 50, recipient, deadline);
  await Promise.all([review.execute(), review.execute()]);
  expect(wallet.completeSwap).toHaveBeenCalledTimes(1);
  expect(wallet.completeSwap).toHaveBeenCalledWith(preview);
  expect(proofService.setProofState).toHaveBeenCalledWith('https://mint.test', ['input'], 'spent');
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

it('prepares a recipient lock without reclaim and keeps unrelated proofs available', async () => {
  const { wallet, proofService } = setup();
  const review = await walletService.prepareP2PK('https://mint.test', 50, recipient);
  expect(review.fee).toBe(2);
  expect(wallet.prepareSwapToSend.mock.calls[0][3]).toEqual({
    send: { type: 'p2pk', options: { pubkey: recipient } },
    keep: { type: 'random' },
  });
  await review.dispose();
  await review.dispose();
  expect(proofService.releaseProofs).toHaveBeenCalledTimes(1);
  expect(proofService.releaseProofs).toHaveBeenCalledWith('https://mint.test', ['input']);
});

it('prepares the P2PK recipient from the npub used by people and conversations', async () => {
  const { wallet } = setup();
  const review = await walletService.prepareP2PK(
    'https://mint.test',
    50,
    npubEncode(recipient.slice(2)),
  );
  expect(wallet.prepareSwapToSend.mock.calls[0][3].send.options).toEqual({ pubkey: recipient });
  expect(review.fee).toBe(2);
  await review.dispose();
});

it('retains input reservations after an ambiguous swap failure without submitting twice', async () => {
  const { wallet, proofService } = setup();
  wallet.completeSwap.mockRejectedValue(new Error('Network unavailable'));
  const review = await walletService.prepareP2PK('https://mint.test', 50, recipient);
  await expect(review.execute()).rejects.toThrow('Network unavailable');
  await review.dispose();
  await expect(review.execute()).rejects.toThrow('Network unavailable');
  expect(wallet.completeSwap).toHaveBeenCalledTimes(1);
  expect(proofService.releaseProofs).not.toHaveBeenCalled();
  expect(proofService.setProofState).not.toHaveBeenCalled();
});

it('rejects an invalid creation fee before reserving inputs', async () => {
  const { preview, proofService, wallet } = setup();
  preview.sendOutputs![0].blindedMessage.amount = 128;
  await expect(walletService.prepareP2PK('https://mint.test', 50, recipient)).rejects.toThrow(
    'creation fee',
  );
  expect(proofService.reserveProofs).not.toHaveBeenCalled();
  expect(wallet.completeSwap).not.toHaveBeenCalled();
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
