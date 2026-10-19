import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { nostrService } from '~/services/wallet/nostrService';
import { RelaySettingsScreen } from '~/features/settings/RelaySettingsScreen';
import { NostrHealthRow } from '~/features/settings/components/NostrHealthRow';
import { useNostrRelayStore } from '~/state/nostrRelayStore';
import { DEFAULT_NOSTR_RELAYS } from '~/shared/utils/nostrRelays';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack', Input: 'Input' }));
jest.mock('@tamagui/lucide-icons', () => ({
  Plus: 'Plus',
  RotateCcw: 'RotateCcw',
  Trash2: 'Trash2',
  HeartPulse: 'HeartPulse',
  Copy: 'Copy',
  Radio: 'Radio',
  RefreshCw: 'RefreshCw',
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: {
    getRelayConnectionStatus: () => ({ 'wss://relay.damus.io': true }),
    reconnectRelays: jest.fn(),
  },
}));
jest.mock('~/services/wallet/nostrDiagnosticsService', () => ({
  nostrDiagnosticsService: { getDiagnostics: jest.fn() },
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ isPending: false, isError: false, data: { overall: 'healthy' } }),
}));

it('supports compact copy/delete controls, live radio status, reconnect, add and reset', async () => {
  useNostrRelayStore.getState().resetRelays();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RelaySettingsScreen />);
  });
  const icons = () => tree.root.findAllByType('AppIconButton' as any);
  expect(icons().filter((icon) => icon.props.icon === 'Trash2')).toHaveLength(
    DEFAULT_NOSTR_RELAYS.length,
  );
  const connected = tree.root
    .findAllByType('Radio' as any)
    .find((view) => view.props.accessibilityLabel === 'Connected');
  expect(connected?.props.color).toBe('$green10');
  expect(
    tree.root
      .findAllByType('Radio' as any)
      .find((view) => view.props.accessibilityLabel === 'Disconnected')?.props.color,
  ).toBe('$red10');
  expect(icons()[0].props.icon).toBe('Copy');
  expect(icons()[1].props.icon).toBe('Trash2');
  expect(icons()[0].props.size).toBe('xxsmall');
  expect(icons()[1].props.size).toBe('xxsmall');
  await act(async () => icons()[0].props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(DEFAULT_NOSTR_RELAYS[0]);
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((button) => button.props.children === 'Reconnect all relays')!
      .props.onPress(),
  );
  expect(nostrService.reconnectRelays).toHaveBeenCalledTimes(1);
  await act(async () =>
    icons()
      .find((icon) => icon.props.accessibilityLabel === `Remove ${DEFAULT_NOSTR_RELAYS[0]}`)!
      .props.onPress(),
  );
  expect(useNostrRelayStore.getState().relays).not.toContain(DEFAULT_NOSTR_RELAYS[0]);
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('wss://custom.example'),
  );
  await act(async () =>
    icons()
      .find((icon) => icon.props.accessibilityLabel === 'Add relay')!
      .props.onPress(),
  );
  expect(useNostrRelayStore.getState().relays).toContain('wss://custom.example');
  let reset!: () => void;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    reset = buttons!.find((button) => button.text === 'Reset')!.onPress as () => void;
  });
  tree.root
    .findAllByType('AppButton' as any)
    .find((button) => button.props.children === 'Reset to defaults')!
    .props.onPress();
  expect(useNostrRelayStore.getState().relays).toContain('wss://custom.example');
  await act(async () => reset());
  expect(useNostrRelayStore.getState().relays).toEqual(DEFAULT_NOSTR_RELAYS);
  await act(async () => tree.unmount());
  alert.mockRestore();
});

it('renders overall Nostr health as a read-only row', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<NostrHealthRow />);
  });
  const row = tree.root.findByType('XStack' as any);
  expect(row.props.accessibilityLabel).toBe('Nostr health, Healthy');
  expect(row.props.onPress).toBeUndefined();
  expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).toEqual([
    'Nostr health',
    'Healthy',
  ]);
  await act(async () => tree.unmount());
});
