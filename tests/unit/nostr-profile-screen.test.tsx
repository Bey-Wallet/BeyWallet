import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InteractionManager, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import NostrProfileScreen from '~/features/nostr/NostrProfileScreen';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockNavigationIndex = 1;
let mockCanGoBack = true;
let mockNpub = 'npub1full-public-key-fixture';
let mockStatus = 'verified';
let mockTab = 'ecash';
let mockLightningEnabled = false;
let mockLightningLoaded = true;
let mockPendingCount = 0;
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: any) => (
      <>
        {typeof options.headerTitle === 'function' ? options.headerTitle() : null}
        {options.header
          ? options.header({
              navigation: { getState: () => ({ index: mockNavigationIndex }), goBack: mockBack },
            })
          : options.headerRight?.()}
      </>
    ),
  },
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => ({ tab: mockTab }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('npubcash-sdk', () => ({}));
jest.mock('~/state/lightningAddressStore', () => ({
  useLightningAddressStore: () => ({
    loaded: mockLightningLoaded,
    enabled: mockLightningEnabled,
    receivingMint: 'https://mint.test',
    autoCollect: true,
    pending: Array.from({ length: mockPendingCount }, (_, id) => ({ id: String(id) })),
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
  ChevronRight: 'ChevronRight',
  Settings2: 'Settings2',
  Coins: 'Coins',
  Zap: 'Zap',
  Plus: 'Plus',
  Landmark: 'Landmark',
  Clock: 'Clock',
}));
jest.mock('~/shared/icons/Nip05VerifiedBadge', () => ({ __esModule: true, default: 'Badge' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/PaymentActionsMenu', () => ({
  PaymentActionsMenu: ({ actions }: any) =>
    actions.map((action: any) =>
      require('react').createElement('MenuAction', {
        key: action.id,
        accessibilityLabel: action.title,
        ...action,
      }),
    ),
}));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) =>
    require('react').createElement(
      'StageLayout',
      null,
      require('react').createElement('ScrollView', null, hero, children),
      footer,
    ),
}));
jest.mock('~/shared/ui/BUI/BUIHeader', () => ({
  BUIHeader: ({ actions, title, titleContent, ...props }: any) =>
    require('react').createElement(
      'Header',
      props,
      titleContent ?? require('react').createElement('Text', null, title),
      actions,
    ),
}));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: ({ children }: any) => children,
  ListTableRow: ({ label, ...props }: any) =>
    require('react').createElement('Row', { accessibilityLabel: label, ...props }),
}));
jest.mock('~/shared/ui/CustomQRCode', () => ({ CustomQRCode: 'QR' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/Blockies', () => ({ __esModule: true, default: 'Blockies' }));

let tree: ReactTestRenderer;
const activePage = () =>
  tree.root
    .findAllByType('YStack' as any)
    .find(
      (node) =>
        node.props.testID?.endsWith('-address-page') && !node.props.accessibilityElementsHidden,
    )!;
beforeEach(() => {
  mockNpub = 'npub1full-public-key-fixture';
  mockStatus = 'verified';
  mockNavigationIndex = 1;
  mockCanGoBack = true;
  mockTab = 'ecash';
  mockLightningEnabled = false;
  mockLightningLoaded = true;
  mockPendingCount = 0;
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
  const qr = activePage().findByType('QR' as any);
  expect(qr.props.value).toBe(mockNpub);
  expect(qr.props.logo).toBeUndefined();
  expect(qr.props.color).toBe('#000000');
  expect(qr.props.backgroundColor).toBe('#FFFFFF');
  expect(activePage().findByType('Blockies' as any).props.seed).toBe(mockNpub);
  const labels = activePage()
    .findAllByType('Text' as any)
    .map((node) => node.props.children);
  expect(labels).toContain('alice@bey.cash');
  expect(labels).toContain(mockNpub);
  expect(labels).toContain('Nostr public key');
  expect(
    activePage()
      .findAllByType('Button' as any)
      .map((button) => button.props.children),
  ).toEqual(['Create payment request']);
  expect(activePage().findByProps({ testID: 'my-addresses-actions' }).props.pb).toBe(34);
  const address = activePage().findByProps({ testID: 'full-receiving-address' });
  expect(address.props.children).toBe(mockNpub);
  expect(address.props.selectable).toBe(true);
  expect(address.props.numberOfLines).toBeUndefined();
  expect(address.props.ellipsizeMode).toBeUndefined();
  expect(
    activePage()
      .findByProps({ testID: 'address-copy-card' })
      .findByProps({ accessibilityLabel: 'Copy public key' }).props.emphasis,
  ).toBe('text');
  expect(
    activePage()
      .findByType('ScrollView' as any)
      .findAllByProps({ testID: 'my-addresses-actions' }),
  ).toHaveLength(0);
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
  expect(activePage().findAllByType('Badge' as any)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Copy Nostr address' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Share ecash address' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: mockNpub });
  tree.root.findByProps({ accessibilityLabel: 'Retry NIP-05 lookup' }).props.onPress();
  expect(mockRefresh).toHaveBeenCalled();
});

it('keeps the verified Nostr identity copy and share payloads intact in the compact layout', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Copy Nostr address' }).props.onPress(),
  );
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('alice@bey.cash');
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Share ecash address' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: 'alice@bey.cash\n' + mockNpub });
});

it('uses the provider LNURL for the Lightning QR and the readable address for Copy and Share', async () => {
  mockTab = 'lightning';
  mockLightningEnabled = true;
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  const { bech32 } = require('bech32');
  const qr = activePage().findByType('QR' as any).props.value;
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
  expect(activePage().findAllByType('Badge' as any)).toHaveLength(0);
});

it('hides the Lightning QR before setup and keeps accessible tabs', async () => {
  mockTab = 'lightning';
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(activePage().findAllByType('QR' as any)).toHaveLength(0);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Share Lightning address' }).props.disabled,
  ).toBe(true);
  expect(
    activePage()
      .findAllByType('Button' as any)
      .some((b) => b.props.children === 'Enable Lightning address'),
  ).toBe(true);
  const ecash = tree.root.findByProps({ accessibilityLabel: 'Ecash' });
  expect(tree.root.findByType('Header' as any).findByProps({ accessibilityLabel: 'Ecash' })).toBe(
    ecash,
  );
  expect(
    activePage()
      .findByType('ScrollView' as any)
      .findAllByProps({ accessibilityRole: 'tablist' }),
  ).toHaveLength(0);
  expect(ecash.props.accessibilityRole).toBe('tab');
  expect(ecash.props.accessibilityState.selected).toBe(false);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Lightning' }).props.accessibilityState.selected,
  ).toBe(true);
  await act(async () => ecash.props.onPress());
  expect(activePage().findByType('QR' as any).props.value).toBe(mockNpub);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Ecash' }).props.accessibilityState.selected,
  ).toBe(true);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Lightning' }).props.accessibilityState.selected,
  ).toBe(false);
});

it('keeps username navigation in the originating settings stack', async () => {
  mockStatus = 'not_found';
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  activePage()
    .findAllByType('Button' as any)
    .find((button) => button.props.children === 'Claim username')!
    .props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/username');
});

it('opens an amount-specific ecash request from the identity tab', async () => {
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  const button = activePage()
    .findAllByType('Button' as any)
    .find((node) => node.props.children === 'Create payment request')!;
  await act(async () => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(modals)/receive?mode=request');
});

it('offers a one-time invoice separately from enabling a permanent Lightning address', async () => {
  mockTab = 'lightning';
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(activePage().findAllByType('QR' as any)).toHaveLength(0);
  const button = activePage()
    .findAllByType('Button' as any)
    .find((node) => node.props.children === 'Create Lightning invoice')!;
  await act(async () => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(modals)/mint');
  expect(mockLightningEnabled).toBe(false);
});

it('shows loading before Lightning settings are available without prompting setup or exposing a QR', async () => {
  mockTab = 'lightning';
  mockLightningLoaded = false;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(
    activePage()
      .findAllByType('Text' as any)
      .map((node) => node.props.children),
  ).toContain('Loading Lightning address…');
  expect(activePage().findAllByType('QR' as any)).toHaveLength(0);
  expect(
    activePage()
      .findAllByType('Button' as any)
      .some((node) => node.props.children === 'Enable Lightning address'),
  ).toBe(false);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Share Lightning address' }).props.disabled,
  ).toBe(true);
});

it('keeps pending incoming payments reachable when the Lightning address is disabled', async () => {
  mockTab = 'lightning';
  mockPendingCount = 2;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  const button = tree.root.findByProps({ accessibilityLabel: 'Pending incoming payments (2)' });
  await act(async () => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/lightning-address-payments');
  expect(activePage().findAllByType('QR' as any)).toHaveLength(0);
});

it('opens address management from an enabled Lightning address', async () => {
  mockTab = 'lightning';
  mockLightningEnabled = true;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  const button = tree.root.findByProps({ accessibilityLabel: 'Manage Lightning address' });
  await act(async () => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/lightning-address');
});

it('uses the BUI back header for Settings and returns direct entries to Settings', async () => {
  await act(async () => {
    tree = create(<NostrProfileScreen settingsMode />);
  });
  const header = () => tree.root.findByType('Header' as any);
  expect(header().props.navigation).toBe('back');
  await act(async () => header().props.onNavigate());
  expect(mockBack).toHaveBeenCalledTimes(1);
  mockNavigationIndex = 0;
  await act(async () => header().props.onNavigate());
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings');
});

it('uses a close header for the receiving modal with a Home fallback', async () => {
  mockCanGoBack = false;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  const header = tree.root.findByType('Header' as any);
  expect(header.props.navigation).toBe('close');
  await act(async () => header.props.onNavigate());
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

it('keeps Lightning connection and receiving mint informational', async () => {
  mockTab = 'lightning';
  mockLightningEnabled = true;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Receiving mint' }).props.onPress,
  ).toBeUndefined();
  expect(tree.root.findByProps({ accessibilityLabel: 'Connection' }).props.onPress).toBeUndefined();
});

it('does not share or render a QR while the public key is unavailable', async () => {
  mockNpub = '';
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  expect(activePage().findAllByType('QR' as any)).toHaveLength(0);
  const button = tree.root.findByProps({ accessibilityLabel: 'Share ecash address' });
  expect(button.props.disabled).toBe(true);
  await act(async () => button.props.onPress());
  expect(share).not.toHaveBeenCalled();
});

it('syncs the header and sharing actions when swiping between address pages', async () => {
  mockLightningEnabled = true;
  await act(async () => {
    tree = create(<NostrProfileScreen />);
  });
  const pager = tree.root.findByProps({ testID: 'address-pager' });
  expect(pager.props.pagingEnabled).toBe(true);
  expect(pager.props.horizontal).toBe(true);
  await act(async () =>
    pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 10000 } } }),
  );
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Lightning' }).props.accessibilityState.selected,
  ).toBe(true);
  expect(activePage().props.testID).toBe('lightning-address-page');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Share Lightning address' }).props.disabled,
  ).toBe(false);
  expect(activePage().findByProps({ testID: 'full-receiving-address' }).props.children).toBe(
    `${mockNpub}@npub.cash`,
  );
  await act(async () =>
    pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 0 } } }),
  );
  expect(activePage().props.testID).toBe('ecash-address-page');
});
