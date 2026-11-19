import React from 'react';
import { Share } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DiagnosticReportScreen } from '~/features/settings/DiagnosticReportScreen';
import { formatDiagnosticReport } from '~/features/settings/diagnosticReport';
import {
  clearDiagnosticFailures,
  getDiagnosticFailures,
  recordDiagnosticFailure,
} from '~/services/feedback/diagnosticFailures';

const mockCopy = jest.fn(async (_text: string) => true);
const mockNetwork = jest.fn();
const mockOpen = jest.fn();
const mockClient = {};
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: () => mockNetwork() }));
jest.mock('~/features/settings/diagnosticSnapshot', () => ({
  createDiagnosticSnapshot: () => ({
    version: '1.2.3',
    build: '42',
    platform: 'android',
    relays: { configured: 2, connected: 1 },
    device: { model: 'SM-test', osVersion: '16', apiLevel: 36 },
    wallet: { initialization: 'ready', hasError: false },
    failures: require('~/services/feedback/diagnosticFailures').getDiagnosticFailures(),
    privateKey: 'must-not-copy',
    mintUrl: 'https://private-mint.test',
  }),
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'Stack' }));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppInput', () => ({ AppTextArea: 'Field' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Label' }));
jest.mock('~/shared/hooks/useAppToast', () => ({ useAppToast: () => ({ copy: mockCopy }) }));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/features/settings/settingsCatalog', () => ({
  settingsLinks: { support: 'https://github.com/Bey-Wallet/BeyWallet/issues' },
}));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsMessage: 'Message',
  SettingsDescription: 'Description',
  SettingsSection: 'Section',
  openSettingsLink: (url: string) => mockOpen(url),
}));

let tree: ReactTestRenderer;
const preview = () => tree.root.findByProps({ testID: 'diagnostic-report-preview' }).props.children;
const button = (title: string) =>
  tree.root.findAllByType('Button' as any).find((node) => node.props.children === title)!;
beforeEach(() => {
  jest.clearAllMocks();
  clearDiagnosticFailures();
  mockNetwork.mockResolvedValue({ isConnected: true, isInternetReachable: true, type: 'WIFI' });
  mockOpen.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const render = async () => {
  await act(async () => {
    tree = create(<DiagnosticReportScreen />);
  });
};

it('allowlists automatic report fields instead of serializing extra diagnostic data', () => {
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

it('copies and shares exactly the visible, sanitized preview only after explicit actions', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render();
  expect(preview()).toContain('Configured relays connected: 1/2');
  expect(preview()).toContain('Network type: WIFI');
  expect(preview()).not.toMatch(/must-not-copy|private-mint/);
  expect(mockCopy).not.toHaveBeenCalled();
  expect(share).not.toHaveBeenCalled();
  expect(mockOpen).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'What happened?' })
      .props.onChangeText('The screen froze. nsec1privatekey 1200 sat'),
  );
  expect(preview()).toContain('The screen froze.');
  expect(preview()).not.toMatch(/nsec1privatekey|1200 sat/);
  await act(async () => button('Copy diagnostic report').props.onPress());
  expect(mockCopy).toHaveBeenCalledWith(preview());
  await act(async () => button('Share report').props.onPress());
  expect(share).toHaveBeenCalledWith({ message: preview(), title: 'Bey Wallet diagnostic report' });
});

it('opens a public issue without putting the report in its URL or posting it automatically', async () => {
  await render();
  await act(async () => button('Report an issue').props.onPress());
  expect(mockOpen).toHaveBeenCalledWith('https://github.com/Bey-Wallet/BeyWallet/issues/new');
  expect(mockCopy).not.toHaveBeenCalled();
  expect(tree.root.findByType('Message' as any).props.children).toContain(
    'Paste your copied report',
  );
});

it('keeps the report usable if network details are unavailable and clears session failures', async () => {
  mockNetwork.mockRejectedValueOnce(new Error('private-network-error'));
  recordDiagnosticFailure('mint_quote', { code: 20006 });
  await render();
  expect(preview()).toContain('Internet reachable: Unavailable');
  expect(preview()).not.toContain('private-network-error');
  expect(preview()).toContain('code 20006');
  expect(button('Copy diagnostic report').props.disabled).toBe(false);
  await act(async () => button('Clear recent failures').props.onPress());
  expect(getDiagnosticFailures()).toHaveLength(0);
  expect(preview()).toContain('No recorded failures');
});

it('shows a recoverable error if native sharing fails', async () => {
  jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('private-error'));
  await render();
  await act(async () => button('Share report').props.onPress());
  const message = tree.root.findByType('Message' as any);
  expect(message.props.error).toBe(true);
  expect(message.props.children).toBe('Could not share the report. Try copying it instead.');
  expect(button('Share report').props.loading).toBe(false);
});

it('releases the loading state when native network status never resolves', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  mockNetwork.mockReturnValueOnce(new Promise(() => {}));
  await render();
  expect(button('Copy diagnostic report').props.disabled).toBe(true);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5001);
  });
  expect(button('Copy diagnostic report').props.disabled).toBe(false);
  expect(preview()).toContain('Internet reachable: Unavailable');
});
