import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SettingsCategoryScreen } from '~/features/settings/SettingsCategoryScreen';
import { SettingsToggleRow } from '~/features/settings/components/SettingsToggleRow';
import {
  settingsCategories,
  settingsTitles,
  type SettingsCategory,
} from '~/features/settings/settingsCatalog';

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
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select?: any) => (select ? select(mockSettings) : mockSettings),
}));
jest.mock('~/services/wallet/currencyService', () => ({ SELECTABLE_CURRENCIES: [] }));
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

it('shows the Bitcoin symbol switch inline and keeps other appearance rows navigable', async () => {
  await act(async () => {
    tree = create(<SettingsCategoryScreen category="preferences" />);
  });
  const rows = tree.root.findAllByType(SettingsToggleRow);
  expect(rows.map((row) => row.props.title)).toEqual(['Bitcoin symbol']);
  expect(mockSettings.setPrimaryCurrency).not.toHaveBeenCalled();
  expect(mockSettings.setShowBitcoinSymbol).not.toHaveBeenCalled();
  expect(mockSettings.setNotificationsEnabled).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  const navigation = tree.root.findAllByType('Row' as any);
  expect(navigation.map((row) => row.props.title)).toEqual(['Theme', 'Fiat currency']);
  navigation[0].props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/theme');
  await rows[0].props.save(true);
  expect(mockSettings.setShowBitcoinSymbol).toHaveBeenCalledWith(true);
});

it('requires authentication before changing the inline biometric setting in either direction', async () => {
  await act(async () => {
    tree = create(<SettingsCategoryScreen category="security" />);
  });
  expect(mockAuthenticate).not.toHaveBeenCalled();
  const [lock] = tree.root.findAllByType(SettingsToggleRow);
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
});

it('persists the inline hide-balance preference', async () => {
  await act(async () => {
    tree = create(<SettingsCategoryScreen category="security" />);
  });
  const hideBalance = tree.root.findAllByType(SettingsToggleRow)[1];
  await hideBalance.props.save(true);
  expect(mockSettings.setHideBalance).toHaveBeenCalledWith(true);
  expect(mockAuthenticate).not.toHaveBeenCalled();
});

it('allocates every setting into the approved nested groups', () => {
  const expected = {
    preferences: [['theme', 'currency', 'bitcoin-symbol']],
    security: [
      ['app-lock', 'hide-balance'],
      ['receiving-policy', 'blocked-people'],
      ['secret-key'],
      ['delete-wallet'],
    ],
    backup: [
      ['recovery-phrase', 'mint-backup', 'export-backup'],
      ['restore-backup', 'recover-funds'],
    ],
    wallet: [['mints', 'fallback-mint', 'lightning-address', 'get-change']],
    nostr: [['relays', 'nostr-health']],
    advanced: [['optimize-wallet'], ['proofs', 'verify-proofs']],
    identity: [['profile', 'username', 'public-key']],
  };
  for (const [key, groups] of Object.entries(expected)) {
    expect(
      settingsCategories[key as SettingsCategory].groups
        .filter((group) => group[0].path !== 'new-ui')
        .map((group) => group.map((item) => item.path)),
    ).toEqual(groups);
  }
  expect(
    ['preferences', 'wallet', 'security', 'nostr', 'advanced', 'identity'].map(
      (key) => settingsTitles[key],
    ),
  ).toEqual([
    'Appearance',
    'Payments & mints',
    'Privacy & security',
    'Network',
    'Wallet tools',
    'Profile & addresses',
  ]);
});

it.each(Object.keys(settingsCategories) as SettingsCategory[])(
  'renders %s groups without mutations and navigates each actionable row',
  async (category) => {
    await act(async () => {
      tree = create(<SettingsCategoryScreen category={category} />);
    });
    expect(tree.root.findAllByType(SettingsToggleRow)).toHaveLength(
      category === 'security' ? 2 : category === 'preferences' ? 1 : 0,
    );
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockSettings.setBiometricEnabled).not.toHaveBeenCalled();
    expect(mockSettings.setHideBalance).not.toHaveBeenCalled();
    expect(mockSettings.setShowBitcoinSymbol).not.toHaveBeenCalled();
    const groups = tree.root.findAllByType('Group' as any);
    expect(groups).toHaveLength(settingsCategories[category].groups.length);
    for (const row of tree.root.findAllByType('Row' as any)) {
      row.props.onPress();
      expect(mockPush).toHaveBeenLastCalledWith(`/(tabs)/settings/${row.props.path}`);
    }
    if (category === 'nostr') {
      expect(tree.root.findByType('Health' as any).props.onPress).toBeUndefined();
    }
  },
);

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
