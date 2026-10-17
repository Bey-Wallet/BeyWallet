import { reclaimPayment } from '~/services/wallet/reclaimPayment';
import { proofService } from '~/services/wallet/proofService';
import { walletService } from '~/services/wallet/walletService';

jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'test-fixture',
    getNostrKeys: async () => ({ pubkey: 'a'.repeat(64), privkey: 'test-signing-key' }),
  },
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { checkProofStates: jest.fn() },
}));
jest.mock('~/services/wallet/walletService', () => ({
  walletService: { receiveP2PK: jest.fn(), receive: jest.fn() },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({
  cleanToken: (v: string) => v,
  decodeToken: () => ({ proofs: [{}, {}] }),
}));

const metadata = { reclaimAt: 1, refundPubkey: '02' + 'a'.repeat(64) };
const states = proofService.checkProofStates as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  states.mockResolvedValue([{ state: 'UNSPENT' }, { state: 'UNSPENT' }]);
});

it('uses the sender signing identity through P2PK receive after the deadline', async () => {
  await expect(reclaimPayment('token', metadata)).resolves.toBe('reclaimed');
  expect(walletService.receiveP2PK).toHaveBeenCalledWith('token', 'test-signing-key');
  expect(walletService.receive).not.toHaveBeenCalled();
});

it('preserves legacy bearer reclaim', async () => {
  await expect(reclaimPayment('legacy')).resolves.toBe('reclaimed');
  expect(walletService.receive).toHaveBeenCalledWith('legacy');
});

it('does not reclaim before eligibility or with a different sender identity', async () => {
  await expect(
    reclaimPayment('token', { ...metadata, reclaimAt: Date.now() + 100000 }),
  ).rejects.toThrow('not arrived');
  await expect(reclaimPayment('token', { ...metadata, refundPubkey: 'other' })).rejects.toThrow(
    'does not match',
  );
  expect(walletService.receiveP2PK).not.toHaveBeenCalled();
});

it('recognizes a recipient who already claimed the entire token', async () => {
  states.mockResolvedValue([{ state: 'SPENT' }, { state: 'SPENT' }]);
  await expect(reclaimPayment('token', metadata)).resolves.toBe('claimed');
  expect(walletService.receiveP2PK).not.toHaveBeenCalled();
});

it.each([
  [{ state: 'UNSPENT' }],
  [{ state: 'SPENT' }, { state: 'UNSPENT' }],
  [{ state: 'PENDING' }, { state: 'UNSPENT' }],
])('does not sweep incomplete, partial, or pending states', async (...state) => {
  states.mockResolvedValue(state);
  await expect(reclaimPayment('token', metadata)).rejects.toThrow();
  expect(walletService.receiveP2PK).not.toHaveBeenCalled();
});

it('never reports reclaimed funds after a recipient/refund race fails', async () => {
  (walletService.receiveP2PK as jest.Mock).mockRejectedValueOnce(new Error('Already spent'));
  await expect(reclaimPayment('token', metadata)).rejects.toThrow('Already spent');
});
