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
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: 'public-key-fixture' }),
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
