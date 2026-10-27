import { nostrService } from '~/services/wallet/nostrService';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import { AppState } from 'react-native';
import { SimplePool } from 'nostr-tools';

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  DeviceEventEmitter: { emit: jest.fn() },
}));
jest.mock('nostr-tools', () => ({
  ...jest.requireActual('nostr-tools'),
  SimplePool: jest.fn(() => ({
    subscribeMany: jest.fn(() => ({ close: jest.fn() })),
    close: jest.fn(),
    listConnectionStatus: () => new Map(),
  })),
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const mockEligibility = {
  initialized: true,
  walletReady: true,
  biometricEnabled: false,
  isAuthenticated: true,
};
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => mockEligibility, subscribe: jest.fn(() => jest.fn()) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => mockEligibility, subscribe: jest.fn(() => jest.fn()) },
}));
const mockRefresh = jest.fn(async () => undefined);
jest.mock('~/state/messageStore', () => ({
  useMessageStore: { getState: () => ({ clear: jest.fn(), refresh: mockRefresh }) },
}));
const mockInsert = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    isInitialized: () => mockEligibility.walletReady,
    getRepo: () => ({ messageRepository: { insert: mockInsert } }),
  },
}));
const service = nostrService as any;
const event = (id: string) => ({ id, pubkey: '03'.repeat(32), tags: [], kind: 4 });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = 'active';
  mockEligibility.biometricEnabled = false;
  mockEligibility.walletReady = true;
  mockEligibility.isAuthenticated = true;
  jest.spyOn(service, 'initializeChat').mockResolvedValue(undefined);
  jest.spyOn(service, '_publishInboxRelayList').mockResolvedValue(true);
  nostrService.start('01'.repeat(32), '02'.repeat(32));
});
afterEach(async () => {
  nostrService.stop();
  await jest.advanceTimersByTimeAsync(1);
  await nostrService.drain();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('serializes a relay burst, deduplicates queued events and yields between events', async () => {
  let finish!: () => void;
  const processed: string[] = [];
  const processor = jest
    .spyOn(service, '_processEvent')
    .mockImplementation(async (...args: any[]) => {
      processed.push(args[0].id);
      if (args[0].id === 'a')
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      service.processedEvents.add(args[0].id);
    });
  service.enqueueEvent(event('a'));
  service.enqueueEvent(event('b'));
  service.enqueueEvent(event('b'));
  await jest.advanceTimersByTimeAsync(0);
  expect(processed).toEqual(['a']);
  finish();
  await Promise.resolve();
  expect(processed).toEqual(['a']);
  await jest.advanceTimersByTimeAsync(20);
  expect(processed).toEqual(['a', 'b']);
  service.enqueueEvent(event('b'));
  await jest.advanceTimersByTimeAsync(20);
  expect(processor).toHaveBeenCalledTimes(2);
});

it('pauses delivery, retains queued events and resumes only when foregrounded and unlocked', async () => {
  const processor = jest.spyOn(service, '_processEvent').mockResolvedValue(undefined);
  const resume = recoveryCoordinator.pause();
  service.enqueueEvent(event('a'));
  await jest.advanceTimersByTimeAsync(0);
  expect(processor).not.toHaveBeenCalled();
  mockEligibility.biometricEnabled = true;
  mockEligibility.isAuthenticated = false;
  resume();
  await jest.advanceTimersByTimeAsync(0);
  expect(processor).not.toHaveBeenCalled();
  mockEligibility.isAuthenticated = true;
  service.appState = 'background';
  service.syncReceiving();
  expect(processor).not.toHaveBeenCalled();
  service.appState = 'active';
  mockEligibility.walletReady = false;
  service.syncReceiving();
  await jest.advanceTimersByTimeAsync(10);
  expect(processor).not.toHaveBeenCalled();
  mockEligibility.walletReady = true;
  service.syncReceiving();
  await jest.advanceTimersByTimeAsync(10);
  expect(processor).toHaveBeenCalledTimes(1);
});

it('does not restart a healthy identity and ignores callbacks from a stopped wallet', async () => {
  const pool = (SimplePool as jest.Mock).mock.results.at(-1)!.value;
  const callback = pool.subscribeMany.mock.calls[0][2].onevent;
  nostrService.start('01'.repeat(32), '02'.repeat(32));
  expect(pool.subscribeMany).toHaveBeenCalledTimes(1);
  nostrService.stop();
  nostrService.start('04'.repeat(32), '05'.repeat(32));
  const processor = jest.spyOn(service, '_processEvent').mockResolvedValue(undefined);
  callback(event('old-wallet'));
  await jest.advanceTimersByTimeAsync(10);
  expect(processor).not.toHaveBeenCalled();
});

it('initializes the new wallet after an old chat initialization settles', async () => {
  await jest.advanceTimersByTimeAsync(0);
  nostrService.stop();
  let finish!: () => void;
  const initialization = service.initializeChat as jest.Mock;
  initialization.mockClear();
  initialization.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  nostrService.start('01'.repeat(32), '02'.repeat(32));
  nostrService.stop();
  nostrService.start('04'.repeat(32), '05'.repeat(32));
  const processor = jest.spyOn(service, '_processEvent').mockResolvedValue(undefined);
  service.enqueueEvent(event('new-wallet'));
  await jest.advanceTimersByTimeAsync(0);
  expect(processor).not.toHaveBeenCalled();
  finish();
  await jest.advanceTimersByTimeAsync(10);
  expect(initialization).toHaveBeenCalledTimes(2);
  expect(processor).toHaveBeenCalledTimes(1);
});

it('keeps failed decryptions retryable and skips UI refresh for already persisted text', async () => {
  const decrypt = jest.spyOn(service, '_decrypt').mockResolvedValueOnce(null);
  await service._processEvent(event('retry'));
  expect(service.processedEvents.has('retry')).toBe(false);
  decrypt.mockResolvedValue({
    id: 'logical-message',
    senderPubkey: '03'.repeat(32),
    recipients: ['02'.repeat(32)],
    text: 'hello',
    createdAt: 1,
    transport: 'nip04',
  });
  mockInsert.mockResolvedValue(false);
  await service._processEvent(event('retry'));
  expect(service.processedEvents.has('retry')).toBe(true);
  expect(mockRefresh).not.toHaveBeenCalled();
});
