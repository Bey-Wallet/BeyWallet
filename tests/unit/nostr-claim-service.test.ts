import { usePeopleStore } from '~/state/peopleStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { nostrClaimService } from '~/services/wallet/nostrClaimService';
import { mintManager } from '~/services/wallet/mintManager';
import { walletService } from '~/services/wallet/walletService';
import { useNostrInboxStore, migrateNostrInbox } from '~/state/nostrInboxStore';
import { getEncodedTokenV3, getEncodedTokenV4, getTokenMetadata } from '@cashu/cashu-ts';
import { networkService } from '~/services/platform/networkService';
import { proofService } from '~/services/wallet';
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';
import { initService } from '~/services/wallet/initService';
import { DeviceEventEmitter } from 'react-native';
import { notificationService } from '~/services/platform/notificationService';
import { historyService } from '~/services/wallet/historyService';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('~/services/wallet/initService', () => ({
  initService: { isInitialized: jest.fn(() => true), getRepo: jest.fn() },
}));
jest.mock('~/services/wallet', () => ({
  proofService: require('~/services/wallet/proofService').proofService,
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { checkProofStates: jest.fn() },
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
    usePeopleStore.setState({ people: {} });
    useNostrReceiveSettingsStore.setState({ policy: 'ask' });
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'accepted');
    trusted.mockResolvedValue(true);
    receiveP2PK.mockResolvedValue(undefined);
    receive.mockResolvedValue(undefined);
    jest.mocked(initService.getRepo).mockReturnValue({
      historyRepository: {
        getSuccessfulReceiveCandidates: jest.fn(async () => []),
      },
    } as any);
    (nostrClaimService as any).recentClaims = [];
    nostrClaimService.start('02'.repeat(32));
  });

  afterEach(() => {
    nostrClaimService.stop();
    jest.restoreAllMocks();
  });

  function receiptForCurrentItem() {
    const metadata = getTokenMetadata(useNostrInboxStore.getState().items[0].tokenString);
    return {
      id: 'own-receipt',
      createdAt: Date.now(),
      type: 'receive',
      mintUrl: metadata.mint,
      unit: metadata.unit,
      amount: metadata.amount,
      token: {
        mint: metadata.mint,
        proofs: metadata.incompleteProofs.map((proof) => ({ ...proof, id: 'keyset' })),
      },
    };
  }

  it('does not report an already-spent token as received without an exact successful local receipt', async () => {
    addPayment('spent-elsewhere');
    const events = jest.spyOn(DeviceEventEmitter, 'emit');
    jest
      .spyOn(useSettingsStore, 'getState')
      .mockReturnValue({ biometricEnabled: false, notificationsEnabled: true } as any);
    receive.mockRejectedValue(Object.assign(new Error('Token already spent'), { code: 11001 }));
    await expect(nostrClaimService.retry('spent-elsewhere')).resolves.toMatchObject({
      status: 'failed',
      failure: { code: 'receipt_unverified', retryable: false },
    });
    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      status: 'failed',
      failure: { code: 'receipt_unverified' },
    });
    expect(useNostrInboxStore.getState().items[0].receiptVerified).not.toBe(true);
    expect(events.mock.calls.some(([name]) => name === 'nostr:received')).toBe(false);
    expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
  });

  it('recovers a completed receive after an interrupted claim without a new receipt notification', async () => {
    addPayment('recovered', false, 4);
    const events = jest.spyOn(DeviceEventEmitter, 'emit');
    jest
      .spyOn(useSettingsStore, 'getState')
      .mockReturnValue({ biometricEnabled: false, notificationsEnabled: true } as any);
    const candidates = initService.getRepo().historyRepository
      .getSuccessfulReceiveCandidates as jest.Mock;
    candidates.mockResolvedValueOnce([]).mockResolvedValueOnce([receiptForCurrentItem()]);
    receive.mockRejectedValue(new Error('proofs already spent'));
    await expect(nostrClaimService.retry('recovered')).resolves.toMatchObject({
      status: 'claimed',
    });
    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      status: 'claimed',
      receiptVerified: true,
    });
    expect(events.mock.calls.some(([name]) => name === 'nostr:received')).toBe(false);
    expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
    expect(receive).toHaveBeenCalledTimes(1);
    nostrClaimService.stop();
    nostrClaimService.start('02'.repeat(32));
    await nostrClaimService.processPending();
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('recognizes an exact previous receipt before attempting redemption again', async () => {
    addPayment('previous-receipt');
    const candidates = initService.getRepo().historyRepository
      .getSuccessfulReceiveCandidates as jest.Mock;
    candidates.mockResolvedValue([receiptForCurrentItem()]);
    await expect(nostrClaimService.retry('previous-receipt')).resolves.toMatchObject({
      status: 'claimed',
    });
    expect(receive).not.toHaveBeenCalled();
    expect(receiveP2PK).not.toHaveBeenCalled();
  });

  it('preserves the original receipt time and attribution when an old token is replayed', async () => {
    addPayment('old-replay');
    const candidates = initService.getRepo().historyRepository
      .getSuccessfulReceiveCandidates as jest.Mock;
    candidates.mockResolvedValue([{ ...receiptForCurrentItem(), createdAt: 1 }]);
    await nostrClaimService.retry('old-replay');
    expect(useNostrInboxStore.getState().items[0].receiptCreatedAt).toBe(1);
    expect(historyService.tagHistoryVia).not.toHaveBeenCalled();
    expect(receive).not.toHaveBeenCalled();
  });

  it('proof refresh leaves spent tokens unverified without a local receipt', async () => {
    addPayment('spent-refresh');
    jest.mocked(proofService.checkProofStates).mockResolvedValue([{ state: 'SPENT' }] as any);
    expect(await useNostrInboxStore.getState().refreshPendingStates()).toBe(0);
    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      status: 'failed',
      failure: { code: 'receipt_unverified' },
    });
    expect(receive).not.toHaveBeenCalled();
  });

  it.each([
    { states: [] },
    { states: [{ state: 'SPENT' }, { state: 'SPENT' }] },
    { states: [{ state: 'PENDING' }] },
  ])(
    'does not infer success from incomplete or pending proof responses: %j',
    async ({ states }) => {
      addPayment('incomplete-refresh');
      jest.mocked(proofService.checkProofStates).mockResolvedValue(states as any);
      await useNostrInboxStore.getState().refreshPendingStates();
      expect(useNostrInboxStore.getState().items[0].status).toBe('pending');
    },
  );

  it('moves legacy unproven claims into verification while preserving verified claims and requests', () => {
    addPayment('legacy');
    const item = { ...useNostrInboxStore.getState().items[0], status: 'claimed' as const };
    const migrated = migrateNostrInbox({
      items: [
        item,
        { ...item, id: 'verified', receiptVerified: true },
        { ...item, id: 'request', type: 'request' },
      ],
    });
    expect(migrated.items[0]).toMatchObject({
      status: 'failed',
      failure: { code: 'receipt_unverified', retryable: false },
    });
    expect(migrated.items[1].status).toBe('claimed');
    expect(migrated.items[2].status).toBe('claimed');
  });

  it('does not claim an item after the user dismissed it', async () => {
    addPayment('dismissed');
    useNostrInboxStore.getState().dismiss('dismissed');

    await expect(nostrClaimService.enqueue('dismissed')).resolves.toMatchObject({
      status: 'dismissed',
    });
    expect(receiveP2PK).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].status).toBe('dismissed');
  });

  it('keeps unknown trusted-mint payments unclaimed, including retries with mint approval', async () => {
    usePeopleStore.setState({ people: {} });
    addPayment('invitation');
    await expect(nostrClaimService.enqueue('invitation')).resolves.toMatchObject({
      status: 'contact_required',
    });
    await expect(nostrClaimService.retry('invitation', { trustMint: true })).resolves.toMatchObject(
      { status: 'contact_required' },
    );
    expect(receive).not.toHaveBeenCalled();
    expect(mintManager.addMint).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].attemptCount).toBeUndefined();
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'accepted');
    await Promise.all([nostrClaimService.processPending(), nostrClaimService.retry('invitation')]);
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('accepting everyone releases waiting requests without trusting unknown mints', async () => {
    usePeopleStore.setState({ people: {} });
    addPayment('waiting');
    trusted.mockResolvedValue(false);
    await nostrClaimService.enqueue('waiting');
    useNostrReceiveSettingsStore.getState().setPolicy('everyone');
    await nostrClaimService.processPending();
    expect(useNostrInboxStore.getState().items[0].status).toBe('approval_required');
    expect(mintManager.addMint).not.toHaveBeenCalled();
    expect(receive).not.toHaveBeenCalled();
    useNostrReceiveSettingsStore.getState().setPolicy('ask');
    expect(Object.values(usePeopleStore.getState().people)[0].contactStatus).toBe('accepted');
  });

  it('blocking and unblocking require a new explicit acceptance in everyone mode', async () => {
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'blocked');
    useNostrReceiveSettingsStore.getState().setPolicy('everyone');
    addPayment('blocked');
    await nostrClaimService.retry('blocked', { trustMint: true });
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'unaccepted');
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'unaccepted');
    await nostrClaimService.processPending();
    expect(receive).not.toHaveBeenCalled();
    expect(Object.values(usePeopleStore.getState().people)[0].contactStatus).toBe('unaccepted');
  });

  it('rechecks permission after mint lookup before redemption', async () => {
    addPayment('blocked-during-check');
    trusted.mockImplementationOnce(async () => {
      usePeopleStore.getState().setContactStatus('01'.repeat(32), 'blocked');
      return true;
    });
    await expect(nostrClaimService.retry('blocked-during-check')).resolves.toMatchObject({
      status: 'contact_required',
    });
    expect(receive).not.toHaveBeenCalled();
  });

  it('waits for contact hydration even on a forced retry', async () => {
    addPayment('loading');
    const hydration = jest.spyOn(usePeopleStore.persist, 'hasHydrated').mockReturnValue(false);
    await expect(nostrClaimService.retry('loading', { trustMint: true })).resolves.toMatchObject({
      status: 'deferred',
    });
    expect(receive).not.toHaveBeenCalled();
    hydration.mockRestore();
  });

  it('does not let proof-state refresh mark unknown offers as received', async () => {
    usePeopleStore.setState({ people: {} });
    addPayment('unknown-spent');
    await useNostrInboxStore.getState().refreshPendingStates();
    expect(proofService.checkProofStates).not.toHaveBeenCalled();
    expect(useNostrInboxStore.getState().items[0].status).toBe('pending');
  });

  it('does not exempt a payment responding to our own request', async () => {
    usePeopleStore.setState({ people: {} });
    addPayment('request-response');
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) => ({ ...item, requestId: 'our-request' })),
    }));
    await expect(nostrClaimService.enqueue('request-response')).resolves.toMatchObject({
      status: 'contact_required',
    });
    expect(receive).not.toHaveBeenCalled();
  });

  it('defers locked wallets and resumes after unlock', async () => {
    addPayment('locked-wallet');
    const settings = jest
      .spyOn(useSettingsStore, 'getState')
      .mockReturnValue({ biometricEnabled: true, notificationsEnabled: false } as any);
    const auth = jest
      .spyOn(useAuthStore, 'getState')
      .mockReturnValue({ isAuthenticated: false } as any);
    await expect(nostrClaimService.retry('locked-wallet')).resolves.toMatchObject({
      status: 'deferred',
      failure: { code: 'wallet_locked' },
    });
    expect(receive).not.toHaveBeenCalled();
    auth.mockRestore();
    settings.mockRestore();
    await nostrClaimService.retry('locked-wallet');
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('waits for receipt settings hydration before applying everyone mode', async () => {
    usePeopleStore.setState({ people: {} });
    addPayment('policy-loading');
    const hydration = jest
      .spyOn(useNostrReceiveSettingsStore.persist, 'hasHydrated')
      .mockReturnValue(false);
    useNostrReceiveSettingsStore.getState().setPolicy('everyone');
    await expect(
      nostrClaimService.retry('policy-loading', { trustMint: true }),
    ).resolves.toMatchObject({ status: 'deferred' });
    expect(receive).not.toHaveBeenCalled();
    hydration.mockRestore();
    await nostrClaimService.processPending();
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('finishes redemption already submitted before a block', async () => {
    addPayment('submitted');
    let finish!: () => void;
    let submitted!: () => void;
    const began = new Promise<void>((resolve) => {
      submitted = resolve;
    });
    receive.mockImplementationOnce(() => {
      submitted();
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const result = nostrClaimService.enqueue('submitted');
    await began;
    usePeopleStore.getState().setContactStatus('01'.repeat(32), 'blocked');
    finish();
    await expect(result).resolves.toMatchObject({ status: 'claimed' });
    expect(receive).toHaveBeenCalledTimes(1);
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
