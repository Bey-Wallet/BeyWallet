import React from 'react';
import { create, act } from 'react-test-renderer';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

let network: (state: any) => void;
let app: (state: any) => void;
let offline = false;
const removeNetwork = jest.fn(),
  removeApp = jest.fn();
function Probe() {
  offline = useOfflineStatus();
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: true });
  jest.mocked(Network.addNetworkStateListener).mockImplementation((listener) => {
    network = listener;
    return { remove: removeNetwork };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    app = listener;
    return { remove: removeApp };
  });
});
afterEach(() => jest.restoreAllMocks());

it('follows connectivity events immediately, accepts unknown state, refreshes on resume, and removes listeners', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(offline).toBe(false);
  await act(async () => network({ isConnected: true, isInternetReachable: false }));
  expect(offline).toBe(true);
  await act(async () => network({}));
  expect(offline).toBe(false);
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: false });
  await act(async () => app('active'));
  expect(offline).toBe(true);
  jest.mocked(Network.getNetworkStateAsync).mockRejectedValue(new Error('unknown'));
  await act(async () => app('active'));
  expect(offline).toBe(true);
  await act(async () => tree.unmount());
  expect(removeNetwork).toHaveBeenCalledTimes(1);
  expect(removeApp).toHaveBeenCalledTimes(1);
});

it('does not let a stale initial read overwrite a more recent network event', async () => {
  let resolve!: (value: any) => void;
  jest.mocked(Network.getNetworkStateAsync).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => network({ isConnected: false }));
  await act(async () => resolve({ isConnected: true }));
  expect(offline).toBe(true);
  await act(async () => tree.unmount());
});
