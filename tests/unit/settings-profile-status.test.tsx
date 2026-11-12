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
  SettingsSection: 'Section',
}));

it('groups Settings without extra category hops and keeps verified profile status', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SettingsScreen />);
  });
  expect(tree.root.findAllByType('VerifiedBadge' as any)).toHaveLength(1);
  const descriptions = () =>
    tree.root.findAllByType('Row' as any).map((row) => row.props.description);
  expect(descriptions().every((description) => description === undefined)).toBe(true);
  mockSettings.secondaryCurrency = 'NONE';
  mockSettings.seedBackedUp = true;
  await act(async () => tree.update(<SettingsScreen />));
  expect(descriptions().every((description) => description === undefined)).toBe(true);
  const groups = tree.root.findAllByType('Group' as any);
  expect(
    groups.map((group) => group.findAllByType('Row' as any).map((row) => row.props.title)),
  ).toEqual([
    ['Appearance', 'Notifications'],
    ['Mints', 'Lightning', 'Backup & recovery', 'Privacy & security'],
    ['Advanced', 'Help & support', 'About Bey'],
  ]);
  const paths = [
    '/(tabs)/settings/preferences',
    '/(tabs)/settings/notifications',
    '/(modals)/mints',
    '/(tabs)/settings/lightning-address',
    '/(tabs)/settings/backup',
    '/(tabs)/settings/security',
    '/(tabs)/settings/advanced',
    '/(tabs)/settings/help',
    '/(tabs)/settings/about',
  ];
  tree.root.findAllByType('Row' as any).forEach((row, index) => {
    row.props.onPress();
    expect(mockPush).toHaveBeenLastCalledWith(paths[index]);
  });
  expect(tree.root.findAllByType('Section' as any).map((node) => node.props.title)).toEqual([
    'PREFERENCES',
    'WALLET',
    'MORE',
  ]);
  const profile = tree.root.findByProps({ accessibilityLabel: 'Profile' });
  profile.props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/settings/identity');
  mockLookup = { ...mockLookup, status: 'error' };
  await act(async () => tree.update(<SettingsScreen />));
  expect(tree.root.findAllByType('VerifiedBadge' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  mockLookup = { ...mockLookup, nip05: null, username: null, status: 'not_found' };
  await act(async () => tree.update(<SettingsScreen />));
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children === 'Profile'),
  ).toBe(true);
  await act(async () => tree.unmount());
});
