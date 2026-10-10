import { nostrClaimService } from '~/services/wallet/nostrClaimService';
import { mintManager } from '~/services/wallet/mintManager';
import { walletService } from '~/services/wallet/walletService';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { getEncodedTokenV3, getEncodedTokenV4 } from '@cashu/cashu-ts';
import { networkService } from '~/services/platform/networkService';

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

function addPayment(id: string, locked = false, version = 3) {
  const token = {
    mint: 'https://mint.example',
    unit: 'sat',
    proofs: [
      {
        id: '01' + 'ab'.repeat(32),
        amount: 21,
        secret: locked
          ? JSON.stringify(['P2PK', { nonce: 'synthetic-only', data: '02' + '01'.repeat(32) }])
          : 'synthetic-only',
        C: '02' + '11'.repeat(32),
      },
    ],
  };
  useNostrInboxStore.getState().addIncoming({
    id,
    type: 'token',
    tokenString: version === 4 ? getEncodedTokenV4(token) : getEncodedTokenV3(token),
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
    (nostrClaimService as any).recentClaims = [];
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
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receiveP2PK).not.toHaveBeenCalled();
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
    receive.mockRejectedValue(new Error('network timeout'));
    addPayment('retry');

    await expect(nostrClaimService.enqueue('retry')).resolves.toMatchObject({ status: 'deferred' });
    const item = useNostrInboxStore.getState().items[0];
    expect(item.failure).toMatchObject({ code: 'network', retryable: true });
    expect(item.attemptCount).toBe(1);
    expect(item.nextRetryAt).toBeGreaterThan(Date.now());
  });

  it('keeps duplicate mint outputs retryable while counters resynchronize', async () => {
    receive.mockRejectedValue(Object.assign(new Error('Duplicate outputs'), { code: 11008 }));
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
    addPayment('p2pk', true);

    await expect(nostrClaimService.enqueue('p2pk')).resolves.toMatchObject({ status: 'failed' });
    const item = useNostrInboxStore.getState().items[0];
    expect(item.failure).toMatchObject({ code: 'p2pk', retryable: false });
    expect(item.nextRetryAt).toBeUndefined();
    expect(receive).not.toHaveBeenCalled();
  });

  it('automatically claims compact V4 ordinary tokens without resolving IDs in the queue', async () => {
    addPayment('v4', false, 4);
    await expect(nostrClaimService.enqueue('v4')).resolves.toMatchObject({ status: 'claimed' });
    expect(receive).toHaveBeenCalledWith(expect.stringMatching(/^cashuB/));
    expect(receiveP2PK).not.toHaveBeenCalled();
  });

  it('registers signing keys only for P2PK tokens and claims them once', async () => {
    addPayment('locked-v4', true, 4);
    await nostrClaimService.enqueue('locked-v4');
    expect(receiveP2PK).toHaveBeenCalledTimes(1);
    expect(receive).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].status).toBe('claimed');
  });

  it('resumes a persisted interrupted claim after startup without duplicate redemption', async () => {
    nostrClaimService.stop();
    addPayment('interrupted');
    useNostrInboxStore.getState().markClaiming('interrupted');
    nostrClaimService.start('02'.repeat(32));
    await nostrClaimService.processPending();
    expect(receive).toHaveBeenCalledTimes(1);
    expect(useNostrInboxStore.getState().items[0].status).toBe('claimed');
  });

  it('defers failed mint-trust lookups rather than rejecting the auto-claim queue', async () => {
    trusted.mockRejectedValueOnce(new Error('network timeout'));
    addPayment('trust-retry');
    await expect(nostrClaimService.enqueue('trust-retry')).resolves.toMatchObject({
      status: 'deferred',
      failure: { code: 'network', retryable: true },
    });
    expect(receive).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].nextRetryAt).toBeGreaterThan(Date.now());
  });

  it('keeps the claim retryable if connectivity detection rejects', async () => {
    jest.mocked(networkService.isOffline).mockRejectedValueOnce(new Error('network unavailable'));
    addPayment('connectivity-retry');
    await expect(nostrClaimService.enqueue('connectivity-retry')).resolves.toMatchObject({
      status: 'deferred',
      failure: { code: 'network', retryable: true },
    });
    expect(receive).not.toHaveBeenCalled();
  });
});
