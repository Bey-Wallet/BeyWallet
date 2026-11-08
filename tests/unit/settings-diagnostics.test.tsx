import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DiagnosticReportScreen } from '~/features/settings/DiagnosticReportScreen';
import { formatDiagnosticReport } from '~/features/settings/diagnosticReport';

const mockCopy = jest.fn();
const mockConnections = jest.fn(() => ({
  'wss://private.example': true,
  'wss://extra.example': true,
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { getRelayConnectionStatus: () => mockConnections() },
}));
jest.mock('~/state/nostrRelayStore', () => ({
  useNostrRelayStore: {
    getState: () => ({ relays: ['wss://private.example', 'wss://offline.example'] }),
  },
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.2.3',
  nativeBuildVersion: '42',
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'Stack' }));
jest.mock('@tamagui/lucide-icons', () => ({ Copy: 'Copy', RefreshCw: 'Refresh' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/features/settings/hooks/useSettingsOperation', () => ({
  useSettingsOperation: () => ({
    copy: mockCopy,
    clear: jest.fn(),
    busy: false,
    error: false,
    message: null,
  }),
}));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsMessage: 'Message',
  SettingsDescription: 'Description',
}));

it('allowlists report fields rather than serializing extra diagnostic data', () => {
  const report = formatDiagnosticReport({
    version: null,
    build: null,
    platform: 'android',
    relays: null,
    secret: 'secret-fixture',
    balance: 123,
    mintUrl: 'private-mint',
  } as any);
  expect(report).toContain('App version: Unavailable');
  expect(report).toContain('Relay connection status: Unavailable');
  expect(report).not.toMatch(/secret-fixture|123|private-mint/);
});

it('copies exactly the visible snapshot, excludes URLs, and refreshes after a connection failure', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<DiagnosticReportScreen />);
  });
  const preview = () => tree.root.findByType('Text' as any).props.children;
  expect(preview()).toContain('Configured relays connected: 1/2');
  expect(preview()).not.toContain('example');
  expect(mockCopy).not.toHaveBeenCalled();
  await act(async () => tree.root.findAllByType('Button' as any)[0].props.onPress());
  expect(mockCopy).toHaveBeenCalledWith(preview());
  mockConnections.mockImplementationOnce(() => {
    throw new Error('private-error');
  });
  await act(async () => tree.root.findAllByType('Button' as any)[1].props.onPress());
  expect(preview()).toContain('Relay connection status: Unavailable');
  expect(preview()).not.toContain('private-error');
  await act(async () => tree.unmount());
});
