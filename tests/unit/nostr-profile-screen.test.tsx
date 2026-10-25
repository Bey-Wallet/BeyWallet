import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InteractionManager, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import NostrProfileScreen from '~/features/nostr/NostrProfileScreen';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockNpub = 'npub1full-public-key-fixture';
let mockStatus = 'verified';
let mockTab = 'ecash';
let mockLightningEnabled = false;
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: any) => (
      <>
        {options.headerTitle?.()}
        {options.headerRight?.()}
      </>
    ),
  },
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ tab: mockTab }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('npubcash-sdk', () => ({}));
jest.mock('~/state/lightningAddressStore', () => ({
  useLightningAddressStore: () => ({
    loaded: true,
    enabled: mockLightningEnabled,
    receivingMint: 'https://mint.test',
    autoCollect: true,
    pending: [],
    connection: 'Listening',
  }),
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
  mockTab = 'ecash';
  mockLightningEnabled = false;
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
  expect(tree.root.findAllByType('Blockies' as any)).toHaveLength(0);
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toContain('alice');
  expect(labels).toContain(mockNpub);
  expect(labels).toContain('Receive ecash over Nostr.');
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
    tree.root.findByProps({ accessibilityLabel: 'Share ecash address' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: mockNpub });
  tree.root.findByProps({ accessibilityLabel: 'Retry NIP-05 lookup' }).props.onPress();
  expect(mockRefresh).toHaveBeenCalled();
});

it('uses the provider LNURL for the Lightning QR and the readable address for Copy and Share', async () => {
  mockTab = 'lightning';
  mockLightningEnabled = true;
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  const { bech32 } = require('bech32');
  const qr = tree.root.findByType('QR' as any).props.value;
  expect(Buffer.from(bech32.fromWords(bech32.decode(qr, 2000).words)).toString()).toBe(
    `https://npub.cash/.well-known/lnurlp/${mockNpub}`,
  );
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Copy Lightning address' }).props.onPress(),
  );
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(`${mockNpub}@npub.cash`);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Share Lightning address' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: `${mockNpub}@npub.cash` });
  expect(tree.root.findAllByType('Badge' as any)).toHaveLength(0);
});

it('hides the Lightning QR before setup and keeps accessible tabs', async () => {
  mockTab = 'lightning';
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(tree.root.findAllByType('QR' as any)).toHaveLength(0);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Share Lightning address' }).props.disabled,
  ).toBe(true);
  expect(
    tree.root
      .findAllByType('Button' as any)
      .some((b) => b.props.children === 'Enable Lightning address'),
  ).toBe(true);
  const ecash = tree.root.findByProps({ accessibilityLabel: 'Ecash' });
  expect(ecash.props.accessibilityRole).toBe('tab');
  await act(async () => ecash.props.onPress());
  expect(tree.root.findByType('QR' as any).props.value).toBe(mockNpub);
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
