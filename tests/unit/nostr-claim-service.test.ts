import { nostrClaimService } from '~/services/wallet/nostrClaimService';
import { mintManager } from '~/services/wallet/mintManager';
import { walletService } from '~/services/wallet/walletService';
import { useNostrInboxStore } from '~/state/nostrInboxStore';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('~/services/wallet/initService', () => ({
  initService: { isInitialized: jest.fn(() => true) },
}));
jest.mock('~/services/wallet/mintManager', () => ({
  mintManager: { isMintTrusted: jest.fn(), addMint: jest.fn() },
}));
jest.mock('~/services/wallet/walletService', () => ({
  walletService: { receiveP2PK: jest.fn(), receive: jest.fn() },
}));
jest.mock('~/services/wallet/historyService', () => ({
  historyService: { tagHistoryVia: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: jest.fn().mockResolvedValue(false) },
}));
jest.mock('~/services/platform/notificationService', () => ({
  notificationService: { sendLocalNotification: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ biometricEnabled: false, notificationsEnabled: false }),
  },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({ isAuthenticated: true }),
    subscribe: () => () => undefined,
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ refreshBalance: jest.fn() }) },
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: {
    getState: () => ({ pendingRequests: [], loadPendingRequests: jest.fn() }),
  },
}));

const trusted = mintManager.isMintTrusted as jest.Mock;
const receiveP2PK = walletService.receiveP2PK as jest.Mock;
const receive = walletService.receive as jest.Mock;

function addPayment(id: string) {
  useNostrInboxStore.getState().addIncoming({
    id,
    type: 'token',
    tokenString: 'cashuAexample',
    amount: 21,
    mintUrl: 'https://mint.example',
    senderPubkey: '01'.repeat(32),
  });
}

describe('nostrClaimService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNostrInboxStore.setState({ items: [], activeClaimId: null });
    trusted.mockResolvedValue(true);
    receiveP2PK.mockResolvedValue(undefined);
    receive.mockResolvedValue(undefined);
    nostrClaimService.start('02'.repeat(32));
  });

  afterEach(() => nostrClaimService.stop());

  it('does not claim an item after the user dismissed it', async () => {
    addPayment('dismissed');
    useNostrInboxStore.getState().dismiss('dismissed');

    await expect(nostrClaimService.enqueue('dismissed')).resolves.toMatchObject({
      status: 'dismissed',
    });
    expect(receiveP2PK).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].status).toBe('dismissed');
  });

  it('claims a trusted-mint payment and serializes duplicate events', async () => {
    addPayment('trusted');
    const results = await Promise.all([
      nostrClaimService.enqueue('trusted'),
      nostrClaimService.enqueue('trusted'),
    ]);

    expect(results.every((result) => result.status === 'claimed')).toBe(true);
    expect(receiveP2PK).toHaveBeenCalledTimes(1);
    expect(useNostrInboxStore.getState().items[0].status).toBe('claimed');
  });

  it('requires explicit approval before trusting an unknown mint', async () => {
    trusted.mockResolvedValue(false);
    addPayment('unknown');

    await expect(nostrClaimService.enqueue('unknown')).resolves.toMatchObject({
      status: 'approval_required',
    });
    expect(receiveP2PK).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].status).toBe('approval_required');
  });

  it('persists retry timing for transient failures', async () => {
    receiveP2PK.mockRejectedValue(new Error('network timeout'));
    addPayment('retry');

    await expect(nostrClaimService.enqueue('retry')).resolves.toMatchObject({ status: 'deferred' });
    const item = useNostrInboxStore.getState().items[0];
    expect(item.failure).toMatchObject({ code: 'network', retryable: true });
    expect(item.attemptCount).toBe(1);
    expect(item.nextRetryAt).toBeGreaterThan(Date.now());
  });

  it('keeps duplicate mint outputs retryable while counters resynchronize', async () => {
    receiveP2PK.mockRejectedValue(Object.assign(new Error('Duplicate outputs'), { code: 11008 }));
    addPayment('duplicate-outputs');

    await expect(nostrClaimService.enqueue('duplicate-outputs')).resolves.toMatchObject({
      status: 'deferred',
      failure: {
        message: 'Wallet outputs are resynchronizing with the mint. The payment will retry.',
        retryable: true,
      },
    });
  });

  it('waits for manual action after a P2PK failure', async () => {
    receiveP2PK.mockRejectedValue(new Error('invalid P2PK signature'));
    addPayment('p2pk');

    await expect(nostrClaimService.enqueue('p2pk')).resolves.toMatchObject({ status: 'failed' });
    const item = useNostrInboxStore.getState().items[0];
    expect(item.failure).toMatchObject({ code: 'p2pk', retryable: false });
    expect(item.nextRetryAt).toBeUndefined();
    expect(receive).not.toHaveBeenCalled();
  });
});
