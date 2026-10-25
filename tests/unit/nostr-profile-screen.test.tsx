import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InteractionManager, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import NostrProfileScreen from '~/features/nostr/NostrProfileScreen';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockNpub = 'npub1full-public-key-fixture';
let mockStatus = 'verified';
jest.mock('expo-router', () => ({
  Stack: { Screen: ({ options }: any) => options.headerRight?.() },
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('~/shared/hooks/useNip05Lookup', () => ({
  useNip05Lookup: () => ({
    nip05: 'alice@bey.cash',
    status: mockStatus,
    loading: false,
    refresh: mockRefresh,
  }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: mockNpub }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  View: 'View',
  ScrollView: 'ScrollView',
  useTheme: () => ({ color: { val: '#ffffff' }, background: { val: '#000000' } }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Check: 'Check',
  Copy: 'Copy',
  RefreshCw: 'RefreshCw',
  Scan: 'Scan',
  Share2: 'Share2',
}));
jest.mock('~/shared/icons/Nip05VerifiedBadge', () => ({ __esModule: true, default: 'Badge' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/CustomQRCode', () => ({ CustomQRCode: 'QR' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/Blockies', () => ({ __esModule: true, default: 'Blockies' }));

let tree: ReactTestRenderer;
beforeEach(() => {
  mockStatus = 'verified';
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((cb: any) => {
    cb();
    return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() } as any;
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('keeps the full QR and copy payload, removes the logo and respects the bottom inset', async () => {
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  const qr = tree.root.findByType('QR' as any);
  expect(qr.props.value).toBe(mockNpub);
  expect(qr.props.logo).toBeUndefined();
  expect(qr.props.color).toBe('#ffffff');
  expect(qr.props.backgroundColor).toBe('#000000');
  expect(tree.root.findByType('Blockies' as any).props.seed).toBe(mockNpub);
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toContain('alice');
  expect(labels).toContain(mockNpub);
  expect(labels).toContain('Receive ecash through your Nostr profile.');
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  expect(tree.root.findByType('ScrollView' as any).props.contentContainerStyle.paddingBottom).toBe(
    50,
  );
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Copy public key' }).props.onPress(),
  );
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(mockNpub);
});

it('never advertises a stale address when lookup fails and still shares the public key', async () => {
  mockStatus = 'error';
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  expect(tree.root.findAllByType('Badge' as any)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Copy Nostr address' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Share profile' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: mockNpub });
  tree.root.findByProps({ accessibilityLabel: 'Retry NIP-05 lookup' }).props.onPress();
  expect(mockRefresh).toHaveBeenCalled();
});

it('keeps username navigation in the originating settings stack', async () => {
  mockStatus = 'not_found';
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  tree.root
    .findAllByType('Button' as any)
    .find((button) => button.props.children === 'Claim username')!
    .props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/username');
});
