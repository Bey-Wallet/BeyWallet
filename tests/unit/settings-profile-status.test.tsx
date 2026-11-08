import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SettingsScreen } from '~/features/settings/SettingsHomeScreen';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
let mockLookup = {
  nip05: 'alice@bey.cash' as string | null,
  username: 'alice' as string | null,
  status: 'verified',
  refresh: mockRefresh,
};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('~/shared/hooks/useNip05Lookup', () => ({ useNip05Lookup: () => mockLookup }));
const mockSettings = {
  npub: 'public-key-fixture',
  theme: 'system',
  secondaryCurrency: 'USD',
  seedBackedUp: false,
  biometricEnabled: true,
  notificationsEnabled: true,
};
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select(mockSettings),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ mints: [{}, {}] }),
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock(
  '@tamagui/lucide-icons',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : key),
      },
    ),
);
jest.mock('~/shared/ui/Blockies', () => ({ __esModule: true, default: 'Avatar' }));
jest.mock('~/shared/icons/NostrIcon', () => ({ __esModule: true, default: 'NostrIcon' }));
jest.mock('~/shared/icons/Nip05VerifiedBadge', () => ({
  __esModule: true,
  default: 'VerifiedBadge',
}));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
}));

it('shows a badge only after verification and offers Claim when the registry has no username', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SettingsScreen />);
  });
  expect(tree.root.findAllByType('VerifiedBadge' as any)).toHaveLength(1);
  const descriptions = () =>
    tree.root.findAllByType('Row' as any).map((row) => row.props.description);
  expect(descriptions().slice(0, 5)).toEqual([
    'System · USD',
    'Enabled in Bey',
    '2 connected mints',
    'App lock on',
    'Recovery phrase not confirmed',
  ]);
  mockSettings.secondaryCurrency = 'NONE';
  mockSettings.seedBackedUp = true;
  await act(async () => tree.update(<SettingsScreen />));
  expect(descriptions()[0]).toBe('System · Sats only');
  expect(descriptions()[4]).toBe('Recovery phrase confirmed');
  const groups = tree.root.findAllByType('Group' as any);
  expect(
    groups.map((group) => group.findAllByType('Row' as any).map((row) => row.props.title)),
  ).toEqual([
    ['Appearance', 'Notifications'],
    ['Payments & mints', 'Privacy & security', 'Backup & recovery'],
    ['Network', 'Wallet tools'],
    ['Help & support', 'Support Bey', 'About Bey Wallet'],
  ]);
  const paths = [
    'preferences',
    'notifications',
    'wallet',
    'security',
    'backup',
    'nostr',
    'advanced',
    'help',
    'supporter',
    'about',
  ];
  tree.root.findAllByType('Row' as any).forEach((row, index) => {
    row.props.onPress();
    expect(mockPush).toHaveBeenLastCalledWith(`/(tabs)/settings/${paths[index]}`);
  });
  const profile = tree.root.findByProps({ accessibilityLabel: 'Profile & addresses' });
  profile.props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/settings/identity');
  mockLookup = { ...mockLookup, status: 'error' };
  await act(async () => tree.update(<SettingsScreen />));
  expect(tree.root.findAllByType('VerifiedBadge' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  mockLookup = { ...mockLookup, nip05: null, username: null, status: 'not_found' };
  await act(async () => tree.update(<SettingsScreen />));
  const claim = tree.root.findByType('Button' as any);
  expect(claim.props.children).toBe('Claim your username');
  claim.props.onPress();
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(tabs)/settings/username',
    params: { claim: '1' },
  });
  await act(async () => tree.unmount());
});
