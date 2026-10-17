import { AppState } from 'react-native';
import { expiryService } from '~/services/wallet/expiryService';
import { walletService } from '~/services/wallet/walletService';

let mockBiometric = false;
let mockUnlocked = false;
const mockUpdate = jest.fn();
const mockAll = jest.fn();
const mockStates = jest.fn();
jest.mock('react-native', () => ({ AppState: { currentState: 'active' } }));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    isInitialized: () => true,
    getRepo: () => ({
      historyRepository: { db: { all: mockAll }, updateHistoryEntryState: mockUpdate },
      proofRepository: { deleteProofs: jest.fn() },
    }),
  },
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { checkProofStates: (...args: unknown[]) => mockStates(...args) },
}));
jest.mock('~/services/wallet/walletService', () => ({
  walletService: { receive: jest.fn(), receiveP2PK: jest.fn() },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({
  encodeToken: () => 'token',
  cleanToken: (s: string) => s,
  decodeToken: () => ({ proofs: [{ secret: 'proof' }] }),
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'fixture',
    getNostrKeys: async () => ({ pubkey: 'a'.repeat(64), privkey: 'test-signing-key' }),
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ biometricEnabled: mockBiometric }) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: mockUnlocked }) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBiometric = false;
  mockUnlocked = false;
  (AppState as { currentState: string }).currentState = 'active';
  mockAll.mockResolvedValue([
    {
      id: 'send',
      mintUrl: 'mint',
      tokenJson: '{}',
      metadata: JSON.stringify({ reclaimAt: 1, refundPubkey: '02' + 'a'.repeat(64) }),
    },
  ]);
  mockStates.mockResolvedValue([{ state: 'UNSPENT' }]);
});

it('sweeps eligible refunds through signed receive and marks refunded only afterward', async () => {
  (walletService.receiveP2PK as jest.Mock).mockImplementationOnce(async () => {
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  await expiryService.checkAndSweepExpiredTokens();
  expect(walletService.receiveP2PK).toHaveBeenCalledWith('token', 'test-signing-key');
  expect(mockUpdate).toHaveBeenCalledWith('send', 'refunded');
});

it.each(['background', 'inactive'])('does not automatically reclaim while %s', async (state) => {
  (AppState as { currentState: string }).currentState = state;
  await expiryService.checkAndSweepExpiredTokens();
  expect(mockAll).not.toHaveBeenCalled();
});

it('does not automatically reclaim while locked', async () => {
  mockBiometric = true;
  await expiryService.checkAndSweepExpiredTokens();
  expect(mockAll).not.toHaveBeenCalled();
  mockUnlocked = true;
  await expiryService.checkAndSweepExpiredTokens();
  expect(walletService.receiveP2PK).toHaveBeenCalledTimes(1);
});

it('keeps failed signed receipt pending', async () => {
  (walletService.receiveP2PK as jest.Mock).mockRejectedValueOnce(
    new Error('Recipient already spent'),
  );
  await expiryService.checkAndSweepExpiredTokens();
  expect(mockUpdate).not.toHaveBeenCalled();
});
