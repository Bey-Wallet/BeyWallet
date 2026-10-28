import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SettingsCategoryScreen } from '~/features/settings/SettingsCategoryScreen';
import { SettingsToggleRow } from '~/features/settings/components/SettingsToggleRow';

const mockPush = jest.fn();
const mockAuthenticate = jest.fn();
const mockSettings = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'USD',
  showBitcoinSymbol: false,
  notificationsEnabled: true,
  hideBalance: false,
  biometricEnabled: false,
  setPrimaryCurrency: jest.fn(),
  setShowBitcoinSymbol: jest.fn(),
  setNotificationsEnabled: jest.fn(),
  setHideBalance: jest.fn(),
  setBiometricEnabled: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('~/state/walletStore', () => ({ useWalletStore: () => [] }));
jest.mock('~/state/nostrReceiveSettingsStore', () => ({
  useNostrReceiveSettingsStore: () => 'ask',
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: (...args: unknown[]) => mockAuthenticate(...args) },
}));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/features/settings/components/NostrHealthRow', () => ({ NostrHealthRow: 'Health' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsDescription: 'Description',
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));
jest.mock('~/shared/icons/NostrIcon', () => ({ __esModule: true, default: 'NostrIcon' }));
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 1 } }));

let tree: ReactTestRenderer;
const Icon = () => null;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('keeps notifications navigable to its dedicated preferences screen', async () => {
  await act(async () => {
    tree = create(<SettingsCategoryScreen category="preferences" />);
  });
  const rows = tree.root.findAllByType(SettingsToggleRow);
  expect(rows.map((row) => row.props.title)).toEqual(['Bitcoin symbol']);
  expect(mockSettings.setPrimaryCurrency).not.toHaveBeenCalled();
  await act(async () => rows[0].props.save(true));
  expect(mockSettings.setShowBitcoinSymbol).toHaveBeenCalledWith(true);
  expect(mockSettings.setNotificationsEnabled).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  const navigation = tree.root.findAllByType('Row' as any);
  expect(navigation.map((row) => row.props.title)).toEqual([
    'Theme',
    'Fiat currency',
    'Notifications',
  ]);
  navigation[0].props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/theme');
  navigation[2].props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/notifications');
});

it('requires authentication before changing the inline biometric setting in either direction', async () => {
  await act(async () => {
    tree = create(<SettingsCategoryScreen category="security" />);
  });
  const [lock, hideBalance] = tree.root.findAllByType(SettingsToggleRow);
  expect(lock.props.requiresApproval).toBe(true);
  mockAuthenticate.mockResolvedValue(false);
  await expect(lock.props.save(true)).rejects.toThrow('Authentication required');
  await expect(lock.props.save(false)).rejects.toThrow('Authentication required');
  expect(mockSettings.setBiometricEnabled).not.toHaveBeenCalled();
  mockAuthenticate.mockResolvedValue(true);
  await lock.props.save(true);
  expect(mockSettings.setBiometricEnabled).toHaveBeenLastCalledWith(true);
  await lock.props.save(false);
  expect(mockSettings.setBiometricEnabled).toHaveBeenLastCalledWith(false);
  await hideBalance.props.save(true);
  expect(mockSettings.setHideBalance).toHaveBeenCalledWith(true);
});

it('updates immediately during slow saves and serializes rapid changes', async () => {
  let resolve!: () => void;
  const save = jest
    .fn()
    .mockImplementationOnce(() => new Promise<void>((done) => (resolve = done)));
  await act(async () => {
    tree = create(
      <SettingsToggleRow title="Notifications" icon={Icon} checked={false} save={save} />,
    );
  });
  const control = () => tree.root.findByType('Switch' as any);
  await act(async () => {
    void control().props.onCheckedChange(true);
  });
  expect(control().props.checked).toBe(true);
  expect(control().props.disabled).toBe(false);
  await act(async () => {
    void control().props.onCheckedChange(false);
  });
  expect(control().props.checked).toBe(false);
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(save.mock.calls).toEqual([[true], [false]]);
});

it('keeps approval-gated switches unchanged until approved and shows rejected saves', async () => {
  let reject!: () => void;
  const save = () =>
    new Promise<void>((_, fail) => {
      reject = () => fail(new Error('Denied'));
    });
  await act(async () => {
    tree = create(
      <SettingsToggleRow
        title="App lock"
        icon={Icon}
        checked={false}
        save={save}
        requiresApproval
      />,
    );
  });
  const control = () => tree.root.findByType('Switch' as any);
  await act(async () => {
    void control().props.onCheckedChange(true);
  });
  expect(control().props.checked).toBe(false);
  expect(control().props.disabled).toBe(true);
  await act(async () => reject());
  expect(control().props.checked).toBe(false);
  expect(control().props.disabled).toBe(false);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
});
