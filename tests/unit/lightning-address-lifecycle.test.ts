import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { createNpubCashClient } from '~/services/api/npubCashClient';
import {
  startLightningAddress,
  stopLightningAddress,
} from '~/services/wallet/lightningAddressLifecycle';
import { useLightningAddressStore, lightningAddressDefaults } from '~/state/lightningAddressStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({
    initialized: true,
    biometricEnabled: false,
  })),
}));
jest.mock('~/services/wallet/plugins/ChangePreparationPlugin', () => ({
  getChangeServices: () => ({}),
}));
jest.mock('~/services/api/npubCashClient', () => ({
  NPUB_CASH: 'https://npub.cash',
  createNpubCashClient: jest.fn(),
}));
const mockSync = jest.fn(async () => {});
const mockInvalidate = jest.fn();
const mockDispose = jest.fn(async () => {});
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn(() => mockUnsubscribe);
jest.mock('~/services/wallet/lightningAddressService', () => ({
  LightningAddressService: jest
    .fn()
    .mockImplementation((_repos, _services, _pubkey, _privkey, client) => ({
      load: async () =>
        require('~/state/lightningAddressStore').useLightningAddressStore.setState({
          loaded: true,
          enabled: true,
        }),
      sync: async () => {
        client('https://npub.cash');
        await mockSync();
      },
      invalidate: () => mockInvalidate(),
      dispose: () => mockDispose(),
    })),
}));

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function app(state: string) {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
  (AppState.addEventListener as jest.Mock).mock.calls.at(-1)[1](state);
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  useSettingsStore.setState({ initialized: true, biometricEnabled: false });
  useAuthStore.setState({ isAuthenticated: true });
  useLightningAddressStore.setState({ ...lightningAddressDefaults });
  mockSync.mockImplementation(async () => {});
  (createNpubCashClient as jest.Mock).mockReturnValue({ subscribe: mockSubscribe });
});
afterEach(async () => {
  await stopLightningAddress();
  jest.useRealTimers();
});

it('waits for settings and authentication, then catches up before subscribing', async () => {
  useSettingsStore.setState({ initialized: false, biometricEnabled: true });
  useAuthStore.setState({ isAuthenticated: false });
  await startLightningAddress({} as any, 'synthetic-key', 'synthetic-pubkey');
  await flush();
  expect(mockSync).not.toHaveBeenCalled();
  useSettingsStore.setState({ initialized: true });
  await flush();
  expect(mockSync).not.toHaveBeenCalled();
  useAuthStore.setState({ isAuthenticated: true });
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(1);
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  expect(mockSync.mock.invocationCallOrder[0]).toBeLessThan(
    mockSubscribe.mock.invocationCallOrder[0],
  );
});

it('stops timers and sockets on lock/background/disable, and catches up on foreground', async () => {
  await startLightningAddress({} as any, 'synthetic-key', 'synthetic-pubkey');
  await flush();
  app('background');
  await flush();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  app('active');
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(2);
  useSettingsStore.setState({ biometricEnabled: true });
  useAuthStore.setState({ isAuthenticated: false });
  await flush();
  expect(jest.getTimerCount()).toBe(0);
  expect(useLightningAddressStore.getState().connection).toBe('Paused');
  useAuthStore.setState({ isAuthenticated: true });
  await flush();
  useLightningAddressStore.setState({ enabled: false });
  await flush();
  expect(jest.getTimerCount()).toBe(0);
  expect(mockInvalidate).toHaveBeenCalledTimes(3);
});

it('debounces realtime bursts, serializes syncs and polls while realtime is unavailable', async () => {
  await startLightningAddress({} as any, 'synthetic-key', 'synthetic-pubkey');
  await flush();
  const update = (mockSubscribe.mock.calls[0] as any)[0];
  for (let i = 0; i < 10; i++) update('synthetic-quote');
  jest.advanceTimersByTime(299);
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(30000);
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(3);
  const offline = (Network.addNetworkStateListener as jest.Mock).mock.calls[0][0];
  offline({ isConnected: false });
  await flush();
  expect(jest.getTimerCount()).toBe(0);
  offline({ isConnected: true, isInternetReachable: true });
  await flush();
  expect(mockSync).toHaveBeenCalledTimes(4);
});

it('backs off reconnects and ignores stale subscription callbacks after disposal', async () => {
  await startLightningAddress({} as any, 'synthetic-key', 'synthetic-pubkey');
  await flush();
  const update = (mockSubscribe.mock.calls[0] as any)[0];
  const error = (mockSubscribe.mock.calls[0] as any)[1];
  error('offline');
  jest.advanceTimersByTime(999);
  await flush();
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(mockSubscribe).toHaveBeenCalledTimes(2);
  (mockSubscribe.mock.calls[1] as any)[1]('offline');
  jest.advanceTimersByTime(1999);
  await flush();
  expect(mockSubscribe).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1);
  await flush();
  expect(mockSubscribe).toHaveBeenCalledTimes(3);
  await stopLightningAddress();
  update('late');
  error('late');
  jest.advanceTimersByTime(60000);
  await flush();
  expect(mockDispose).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  expect(useLightningAddressStore.getState().loaded).toBe(false);
});
