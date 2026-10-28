import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DeviceEventEmitter } from 'react-native';
import { useCocoEvents } from '~/shared/hooks/useCocoEvents';
import { feedbackCoordinator } from '~/services/feedback/feedbackCoordinator';
const mockHandlers = new Map<string, (payload: unknown) => void>();
const mockEntry = jest.fn();
const mockTransferLeg = jest.fn();
const mockManager = {};
const mockRefresh = jest.fn();
jest.mock('~/services/wallet', () => ({
  initService: {
    isInitialized: () => true,
    getManager: () => mockManager,
    getRepo: () => ({
      db: { get: mockTransferLeg },
      historyRepository: { getMintHistoryEntry: mockEntry, getMeltHistoryEntry: mockEntry },
    }),
  },
  eventService: {
    on: (name: string, callback: (payload: unknown) => void) => {
      mockHandlers.set(name, callback);
      return () => mockHandlers.delete(name);
    },
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) =>
    selector({ isInitializing: false, refreshCounter: 0, refreshBalance: mockRefresh }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('~/services/wallet/mintTransferService', () => ({
  subscribeMintTransfers: () => () => {},
}));
function Host() {
  useCocoEvents();
  return null;
}
let tree: ReactTestRenderer;
const toast = jest.fn();
const notification = jest.fn();
beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockHandlers.clear();
  feedbackCoordinator.clear();
  const markers = new Set<string>();
  feedbackCoordinator.bind('wallet', {
    reserve: async (_event, key) => {
      if (markers.has(key)) return false;
      markers.add(key);
      return true;
    },
  });
  feedbackCoordinator.connect({
    foreground: () => true,
    unlocked: () => true,
    toast,
    notification,
  });
  mockTransferLeg.mockResolvedValue(undefined);
  mockEntry.mockResolvedValue({ id: '1', state: 'ISSUED', amount: 20, createdAt: Date.now() });
  await act(async () => {
    tree = create(<Host />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  feedbackCoordinator.clear();
  jest.useRealTimers();
});
async function emit(name: string, payload: unknown) {
  await act(async () => {
    mockHandlers.get(name)!(payload);
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
  await feedbackCoordinator.flush();
}

it('keeps raw SDK/proof/balance and legacy Nostr/address refresh signals quiet', async () => {
  for (const name of [
    'receive:created',
    'send:created',
    'proofs:saved',
    'proofs:state-changed',
    'history:updated',
  ])
    await emit(name, {});
  DeviceEventEmitter.emit('nostr:received', { amount: 20, eventId: 'same-receipt' });
  DeviceEventEmitter.emit('lightning-address:received', { amount: 20 });
  await feedbackCoordinator.flush();
  expect(toast).not.toHaveBeenCalled();
  expect(notification).not.toHaveBeenCalled();
});

it('deduplicates a saved quote outcome and suppresses Transfer legs', async () => {
  const quote = { mintUrl: 'https://mint.example', quoteId: 'quote' };
  await emit('mint-quote:redeemed', quote);
  await emit('mint-quote:redeemed', quote);
  expect(toast).toHaveBeenCalledTimes(1);
  mockTransferLeg.mockResolvedValue({ id: 'transfer' });
  await emit('mint-quote:redeemed', { ...quote, quoteId: 'internal-leg' });
  expect(toast).toHaveBeenCalledTimes(1);
});

it('does not convert missing, pending, unknown or historical outcomes into fresh payment success', async () => {
  const quote = { mintUrl: 'https://mint.example', quoteId: 'quote' };
  for (const state of [undefined, 'PENDING', 'UNPAID', 'unknown']) {
    mockEntry.mockResolvedValue(state ? { id: '1', state, createdAt: Date.now() } : null);
    await emit('mint-quote:redeemed', quote);
  }
  mockEntry.mockResolvedValue({ id: 'old', state: 'ISSUED', createdAt: 1, amount: 20 });
  await emit('mint-quote:redeemed', quote);
  expect(toast).not.toHaveBeenCalled();
  expect(notification).not.toHaveBeenCalled();
});

it('checks the mint as well as the quote when excluding internal Transfer legs', async () => {
  mockTransferLeg.mockImplementation(async (_sql, parameters) =>
    parameters[1] === 'https://transfer.example' ? { id: 'transfer' } : undefined,
  );
  await emit('mint-quote:redeemed', { mintUrl: 'https://transfer.example', quoteId: 'shared-id' });
  await emit('mint-quote:redeemed', { mintUrl: 'https://other.example', quoteId: 'shared-id' });
  expect(toast).toHaveBeenCalledTimes(1);
});
