import { QueryClient } from '@tanstack/react-query';
import { createDiagnosticSnapshot } from '~/features/settings/diagnosticSnapshot';
import { formatDiagnosticReport } from '~/features/settings/diagnosticReport';

const mockConnections = jest.fn();
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { getRelayConnectionStatus: () => mockConnections() },
}));
jest.mock('~/services/wallet/initService', () => ({ initService: { isInitialized: () => true } }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: {
    getState: () => ({
      isInitializing: false,
      error: 'private-wallet-error',
      balance: 999,
      mints: [
        { mintUrl: 'https://one.private.test/' },
        { mintUrl: 'https://two.private.test' },
        { mintUrl: 'https://three.private.test' },
      ],
    }),
  },
}));
jest.mock('~/state/nostrRelayStore', () => ({
  useNostrRelayStore: { getState: () => ({ relays: ['wss://private-relay.test'] }) },
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.2.3',
  nativeBuildVersion: '42',
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {}, deviceName: 'personal-device-name' },
}));
jest.mock('expo-updates', () => ({
  runtimeVersion: '1.2.3',
  updateId: 'update-fixture',
  isEmbeddedLaunch: false,
}));

it('reports cached checks only for connected mints and exports no URLs or wallet error text', () => {
  const client = new QueryClient();
  try {
    mockConnections.mockReturnValue({
      'wss://private-relay.test': true,
      'wss://extra.private.test': true,
    });
    client.setQueryData(['mint-metadata', 'https://one.private.test'], {
      nuts: {},
      secret: 'private-proof',
    });
    const failed = client
      .getQueryCache()
      .build(client, { queryKey: ['mint-metadata', 'https://two.private.test'] });
    failed.setState({
      errorUpdatedAt: Date.now(),
      status: 'error',
      error: new Error('private-error'),
    });
    client.setQueryData(['mint-metadata', 'https://unconnected.private.test'], { nuts: {} });
    const snapshot = createDiagnosticSnapshot(client);
    expect(snapshot.mints).toMatchObject({ connected: 3, successful: 1, failed: 1, unchecked: 1 });
    expect(snapshot.relays).toEqual({ configured: 1, connected: 1 });
    expect(snapshot.wallet).toEqual({ initialization: 'ready', hasError: true });
    expect(formatDiagnosticReport(snapshot)).not.toMatch(/private|personal-device-name|999/);
  } finally {
    client.clear();
  }
});

it('still creates a report when relay status is unavailable', () => {
  const client = new QueryClient();
  try {
    mockConnections.mockImplementationOnce(() => {
      throw new Error('private-error');
    });
    expect(createDiagnosticSnapshot(client).relays).toBeNull();
  } finally {
    client.clear();
  }
});
