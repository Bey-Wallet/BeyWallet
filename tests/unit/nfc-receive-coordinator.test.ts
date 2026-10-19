import { PaymentRequest, getEncodedTokenV3 } from '@cashu/cashu-ts';
import { AppState } from 'react-native';
import {
  NfcReceiveCoordinator,
  nfcRequestAdvertisement,
  validateNfcOffer,
} from '~/services/wallet/nfcReceiveCoordinator';
import { nfcService } from '~/services/platform/nfcService';
import { walletService } from '~/services/wallet/walletService';
import { completeNfcReceipt } from '~/storage/sqlite/repositories/nfcRequestReceipts';

let mockPending: any;
let mockReceipt: any;
let mockRequest: any;
let mockReady = true;
let mockAuthenticated = true;
let mockFee = 0;
let mockCreateReceipt = true;
let mockAcknowledgeSuccess = true;
const mockReservations = new Map<string, string>();
const mockMarkReceived = jest.fn(async () => {
  mockRequest.state = 'received';
});
jest.mock('~/services/platform/nfcService', () => ({
  nfcService: {
    getPendingPayment: jest.fn(async () => mockPending),
    pauseRequestSession: jest.fn(async () => {}),
    acknowledgePayment: jest.fn(async () => {
      if (!mockAcknowledgeSuccess) return false;
      mockPending = null;
      return true;
    }),
  },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    isInitialized: () => mockReady,
    getManager: () => ({
      wallet: { decodeToken: async () => ({ proofs: [] }) },
      walletService: { getWallet: async () => ({ getFeesForProofs: () => mockFee }) },
    }),
    getRepo: () => ({ keysetRepository: {} }),
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ initialized: true, biometricEnabled: true }) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: mockAuthenticated }) },
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: {
    getState: () => ({
      requests: [mockRequest],
      loadPendingRequests: async () => {},
      markReceived: mockMarkReceived,
    }),
  },
}));
jest.mock('~/storage/sqlite/repositories/nfcRequestReceipts', () => ({
  reserveNfcReceipt: async (fingerprint: string, requestId: string) => {
    const previous = mockReservations.get(fingerprint);
    if (previous && previous !== requestId) throw new Error('Already associated');
    mockReservations.set(fingerprint, requestId);
  },
  completeNfcReceipt: jest.fn(async () => {}),
}));
jest.mock('~/services/wallet/nostrReceiptService', () => ({
  findTokenReceiveReceipt: jest.fn(async () => mockReceipt),
}));
jest.mock('~/services/wallet/mintManager', () => ({
  mintManager: { isMintTrusted: jest.fn(async () => true) },
}));
jest.mock('~/services/wallet/cashuReceiveKeysets', () => ({
  refreshReceiveKeysets: jest.fn(async () => {}),
}));
jest.mock('~/services/wallet/walletService', () => ({
  walletService: {
    receive: jest.fn(async () => {
      if (mockCreateReceipt) mockReceipt = { id: 'receipt', createdAt: 2000 };
    }),
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ refreshBalance: async () => {} }) },
}));
import { mintManager } from '~/services/wallet/mintManager';
import { refreshReceiveKeysets } from '~/services/wallet/cashuReceiveKeysets';

function token(amount = 8, mint = 'https://mint.example', unit = 'sat') {
  return getEncodedTokenV3({
    mint,
    unit,
    proofs: [{ amount, id: '00'.repeat(8), C: '02' + '01'.repeat(32), secret: 'test-proof' }],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReservations.clear();
  mockReady = true;
  mockAuthenticated = true;
  mockFee = 0;
  mockCreateReceipt = true;
  mockAcknowledgeSuccess = true;
  AppState.currentState = 'active';
  mockReceipt = undefined;
  mockRequest = {
    id: 'request',
    mintUrl: 'https://mint.example',
    amount: 8,
    unit: 'sat',
    state: 'pending',
    createdAt: 1000,
    creqString: new PaymentRequest(
      [],
      'request',
      8,
      'sat',
      ['https://mint.example'],
      'Lunch',
    ).toEncodedRequest(),
  };
  mockPending = { id: 'native-slot', requestId: 'request', content: token(), receivedAt: 1500 };
  jest.mocked(mintManager.isMintTrusted).mockResolvedValue(true);
  jest.mocked(walletService.receive).mockImplementation(async () => {
    if (mockCreateReceipt) mockReceipt = { id: 'receipt', createdAt: 2000 };
  });
});

async function run() {
  const coordinator = new NfcReceiveCoordinator();
  coordinator.setReady(true);
  await coordinator.processPending();
  return coordinator;
}

it('advertises the same terms without Nostr return transport, excluding restricted requests', () => {
  const advertisement = PaymentRequest.fromEncodedRequest(nfcRequestAdvertisement(mockRequest)!);
  expect(advertisement).toMatchObject({
    id: 'request',
    amount: 8,
    unit: 'sat',
    description: 'Lunch',
    transport: [],
  });
  expect(
    nfcRequestAdvertisement({ ...mockRequest, recipient: 'authenticated-person' }),
  ).toBeUndefined();
});
it.each([
  [
    'wrong request',
    () => {
      mockPending.requestId = 'another';
    },
  ],
  [
    'wrong mint',
    () => {
      mockPending.content = token(8, 'https://other.example');
    },
  ],
  [
    'wrong unit',
    () => {
      mockPending.content = token(8, 'https://mint.example', 'usd');
    },
  ],
  [
    'underpayment',
    () => {
      mockPending.content = token(4);
    },
  ],
  [
    'recipient restriction',
    () => {
      mockRequest.recipient = 'person';
    },
  ],
])('preserves %s for review without redemption', async (_label, change) => {
  change();
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('deduplicates concurrent work and acknowledges only after receipt and request persistence', async () => {
  const coordinator = new NfcReceiveCoordinator();
  coordinator.setReady(true);
  await Promise.all([coordinator.processPending(), coordinator.processPending()]);
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(mockMarkReceived).toHaveBeenCalledTimes(1);
  expect(nfcService.acknowledgePayment).toHaveBeenCalledWith('native-slot');
  expect(coordinator.getSnapshot()).toEqual({
    status: 'idle',
    requestId: 'request',
    receiptId: 'receipt',
  });
  expect(mockMarkReceived.mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(nfcService.acknowledgePayment).mock.invocationCallOrder[0],
  );
});
it('drains a completed write arriving during the startup pending-file read', async () => {
  let finishRead!: (value: null) => void;
  jest.mocked(nfcService.getPendingPayment).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const coordinator = new NfcReceiveCoordinator();
  coordinator.setReady(true);
  const completedWrite = coordinator.processPending();
  finishRead(null);
  await completedWrite;
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(nfcService.acknowledgePayment).toHaveBeenCalled();
});
it('does not succeed solely because receive resolved or proofs are spent', async () => {
  mockCreateReceipt = false;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(coordinator.getSnapshot()).not.toHaveProperty('receiptId');
  expect(mockMarkReceived).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('releases stale review when the authoritative native slot is empty', async () => {
  mockCreateReceipt = false;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  mockPending = null;
  await coordinator.processPending();
  expect(coordinator.getSnapshot()).toEqual({ status: 'idle' });
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(mockMarkReceived).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('retains a completed receipt when a later native-slot check is empty', async () => {
  const coordinator = await run();
  const completed = coordinator.getSnapshot();
  await coordinator.processPending();
  expect(coordinator.getSnapshot()).toBe(completed);
  expect(completed).toMatchObject({ status: 'idle', requestId: 'request', receiptId: 'receipt' });
});
it('recovers a receipt after a crash without redeeming again', async () => {
  mockReceipt = { id: 'saved', createdAt: 2000 };
  await run();
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(mockMarkReceived).toHaveBeenCalled();
});
it('publishes the same receipt only after acknowledgement succeeds without receiving twice', async () => {
  mockAcknowledgeSuccess = false;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(coordinator.getSnapshot()).not.toHaveProperty('receiptId');
  expect(mockPending).not.toBeNull();
  mockAcknowledgeSuccess = true;
  await coordinator.retry();
  expect(coordinator.getSnapshot()).toEqual({
    status: 'idle',
    requestId: 'request',
    receiptId: 'receipt',
  });
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(mockPending).toBeNull();
});
it('does not settle a request with an unrelated receipt recorded before the NFC offer', async () => {
  mockReceipt = { id: 'older-receipt', createdAt: 1200 };
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(mockMarkReceived).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('acknowledges a concurrent QR receipt already associated with the same request', async () => {
  mockReceipt = { id: 'qr-receipt', createdAt: 1200, metadata: { requestId: 'request' } };
  await run();
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).toHaveBeenCalled();
});
it('preserves untrusted mint offers', async () => {
  jest.mocked(mintManager.isMintTrusted).mockResolvedValue(false);
  await run();
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('preserves an unknown keyset offer and explains why it cannot be confirmed', async () => {
  jest
    .mocked(refreshReceiveKeysets)
    .mockRejectedValueOnce(
      new Error('Unknown Keyset: token keyset is not uniquely advertised by its mint'),
    );
  const coordinator = await run();
  expect(coordinator.getSnapshot()).toMatchObject({
    status: 'review',
    message:
      'NFC payment saved but not confirmed. Its keyset is not uniquely advertised by the mint. Check with the sender before retrying.',
  });
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(mockMarkReceived).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
  expect(mockPending).not.toBeNull();
});
it('retains offline failures and recovers a concurrent QR receipt on retry', async () => {
  jest.mocked(walletService.receive).mockRejectedValue(new Error('offline'));
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  mockReceipt = { id: 'qr-receipt', createdAt: 2000 };
  await coordinator.retry();
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(nfcService.acknowledgePayment).toHaveBeenCalled();
});
it('does not receive while locked', async () => {
  mockAuthenticated = false;
  await run();
  expect(nfcService.getPendingPayment).not.toHaveBeenCalled();
});
it('accepts sender-covered receiving fees and records the net received amount', async () => {
  mockPending.content = token(12);
  mockFee = 4;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('idle');
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(completeNfcReceipt).toHaveBeenCalledWith(expect.any(String), 'request', 'receipt', {
    requestedAmount: 8,
    fee: 4,
    netAmount: 8,
    receivingFeeCovered: true,
  });
});
it('receives the requested face value when the receiver covers the fee and records the shortfall', async () => {
  mockFee = 1;
  const coordinator = await run();
  expect(coordinator.getSnapshot()).toMatchObject({
    status: 'idle',
    receiptId: 'receipt',
  });
  expect(walletService.receive).toHaveBeenCalledTimes(1);
  expect(completeNfcReceipt).toHaveBeenCalledWith(expect.any(String), 'request', 'receipt', {
    requestedAmount: 8,
    fee: 1,
    netAmount: 7,
    receivingFeeCovered: false,
  });
  expect(mockMarkReceived).toHaveBeenCalledTimes(1);
  expect(nfcService.acknowledgePayment).toHaveBeenCalled();
});
it.each([8, 9])('retains a token whose fee %s leaves no positive received value', async (fee) => {
  mockFee = fee;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it.each([-1, 0.5, NaN, Infinity])('retains invalid fee %s without redemption', async (fee) => {
  mockFee = fee;
  const coordinator = await run();
  expect(coordinator.getSnapshot().status).toBe('review');
  expect(walletService.receive).not.toHaveBeenCalled();
  expect(nfcService.acknowledgePayment).not.toHaveBeenCalled();
});
it('rejects a second request attempting to reuse a fingerprint', async () => {
  const saved = { ...mockPending };
  await run();
  mockRequest = { ...mockRequest, id: 'second', state: 'pending' };
  mockPending = { ...saved, requestId: 'second' };
  await run();
  expect(mockMarkReceived).toHaveBeenCalledTimes(1);
});
it('deduplicates proof ordering and normalized mint URLs', () => {
  const first = validateNfcOffer(mockRequest, 'request', token()).fingerprint;
  expect(
    validateNfcOffer(mockRequest, 'request', token(8, 'https://mint.example/')).fingerprint,
  ).toBe(first);
});
