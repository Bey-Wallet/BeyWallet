import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AddMintScreen from '~/features/mints/AddMintScreen';
import MintsScreen from '~/features/mints/MintsScreen';
import { useWalletStore } from '~/state/walletStore';
import { ConnectedMintsCard } from '~/features/home/components/ConnectedMintsCard';
import { RECOMMENDED_MINTS } from '~/features/home/components/mintPlaceholders';

const mockPush = jest.fn();
let mockDiscoveredMints: { url: string; name: string }[] = [];
let mockMintMetadata: Record<string, Record<string, unknown>> = {};
let mockMintErrors: Record<string, Error> = {};
let mockDeviceOffline = false;
let mockHideBalance = false;
let mockSkipDisclaimer = false;
const mockRecheckMint = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockCheckingMints: string[] = [];
const mockRouter = { push: mockPush, canGoBack: () => true, back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Stack: { Screen: 'Screen' } }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('tamagui', () => ({
  useThemeName: () => 'dark',
  ...Object.fromEntries(
    ['Input', 'Text', 'YStack', 'XStack', 'Paragraph', 'View', 'ScrollView', 'Separator', 'H6'].map(
      (name) => [name, name],
    ),
  ),
  useTheme: () => new Proxy({}, { get: () => ({ val: '#888' }) }),
  styled: () => 'RowContainer',
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }: any) =>
    queries.map(({ queryKey }: any) => ({
      error: mockMintErrors[queryKey[1]],
      isFetching: mockCheckingMints.includes(queryKey[1]),
      refetch: (options: unknown) => mockRecheckMint(queryKey[1], options),
    })),
  useQuery: ({ queryKey }: any) => ({
    data:
      queryKey[0] === 'all-mint-recommendations'
        ? mockDiscoveredMints
        : queryKey[0] === 'mint-metadata'
          ? mockMintMetadata[queryKey[1]]
          : undefined,
    isLoading: false,
    error: queryKey[0] === 'mint-metadata' ? mockMintErrors[queryKey[1]] : undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(
    () => ({
      primaryCurrency: 'SATS',
      secondaryCurrency: 'NONE',
      hideBalance: mockHideBalance,
      hideMintConnectionDisclaimer: mockSkipDisclaimer,
    }),
    {
      getState: () => ({
        hideMintConnectionDisclaimer: mockSkipDisclaimer,
        setHideMintConnectionDisclaimer: async (hide: boolean) => {
          mockSkipDisclaimer = hide;
        },
      }),
    },
  ),
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ children, ...props }: any, ref: any) => {
    const [open, setOpen] = require('react').useState(false);
    require('react').useImperativeHandle(ref, () => ({
      present: () => setOpen(true),
      dismiss: () => {
        if (props.canDismiss) setOpen(false);
      },
    }));
    return open ? require('react').createElement('TrustSheet', props, children) : null;
  }),
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockDeviceOffline }));
jest.mock('~/services/wallet/currencyService', () => ({ currencyService: {} }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/api/mintRecommendationService', () => ({ mintRecommendationService: {} }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));
jest.mock('~/features/explore/components/MintIcon', () => ({ MintIcon: 'MintIcon' }));
jest.mock('~/shared/ui/RollingNumber', () => ({ RollingNumber: 'RollingNumber' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success' },
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveredMints = [];
  mockMintMetadata = {};
  mockMintErrors = {};
  mockDeviceOffline = false;
  mockHideBalance = false;
  mockSkipDisclaimer = false;
  mockCheckingMints = [];
  useWalletStore.setState({
    mints: [],
    balances: {},
    activeMintUrl: null,
    refreshCounter: 0,
    scannerResult: null,
    setScannerResult: (scannerResult) => useWalletStore.setState({ scannerResult }),
    addMint: jest.fn(async (mintUrl) => {
      useWalletStore.setState({ mints: [{ mintUrl, trusted: true }] });
    }),
    error: null,
    refreshMintList: jest.fn(),
    refreshBalance: jest.fn(),
    isRefreshing: false,
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

const connectedRow = (mintUrl: string) =>
  tree.root
    .findAllByType('RowContainer' as any)
    .find((row) =>
      row.findAllByType('MintImage' as any).some((icon) => icon.props.mintUrl === mintUrl),
    )!;

it('marks only the active mint and mutes visible zero balances', async () => {
  const activeUrl = 'https://active.example';
  const otherUrl = 'https://other.example';
  useWalletStore.setState({
    mints: [
      { mintUrl: activeUrl, name: 'Active', trusted: true },
      { mintUrl: otherUrl, name: 'Other', trusted: true },
    ],
    activeMintUrl: `${activeUrl}/`,
    balances: { [activeUrl]: 0, [otherUrl]: 4200 },
  });
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  expect(connectedRow(activeUrl).findAllByProps({ bg: '$green10' })).toHaveLength(1);
  expect(
    connectedRow(activeUrl)
      .findByProps({ bg: '$green10' })
      .findByType('Check' as any),
  ).toBeDefined();
  expect(connectedRow(otherUrl).findAllByProps({ bg: '$green10' })).toHaveLength(0);
  expect(connectedRow(activeUrl).parent!.props.accessibilityLabel).toContain('active mint');
  expect(connectedRow(activeUrl).findByType('RollingNumber' as any).props.color).toBe('$gray10');
  expect(connectedRow(otherUrl).findByType('RollingNumber' as any).props.color).toBe('$color');

  mockHideBalance = true;
  await act(async () => {
    useWalletStore.setState({ refreshCounter: 1 });
  });
  expect(connectedRow(activeUrl).findByType('RollingNumber' as any).props).toMatchObject({
    color: '$color',
    children: '****',
  });
});

it('dims an unreachable mint and rechecks it without opening its details', async () => {
  const mintUrl = 'https://mint.example';
  useWalletStore.setState({
    mints: [{ mintUrl, name: 'Example mint', trusted: true }],
    balances: { [mintUrl]: 4200 },
  });
  mockMintMetadata[mintUrl] = {
    nuts: { '4': { methods: [{ method: 'bolt11', unit: 'sat' }] }, '30': { supported: true } },
  };
  mockMintErrors[mintUrl] = new Error('Mint unreachable');
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  const row = connectedRow(mintUrl);
  expect(
    row.findAllByType('Text' as any).find((text) => text.props.children === 'Example mint')?.props
      .color,
  ).toBe('$color');
  expect(row.parent!.props.opacity).toBe(0.5);
  expect(row.findByType('RollingNumber' as any).props).toMatchObject({
    color: '$color',
    children: 4200,
    suffix: ' sat',
  });
  const refresh = tree.root.findByProps({ accessibilityLabel: 'Recheck Example mint connection' });
  await act(async () => refresh.props.onPress());
  expect(mockRecheckMint).toHaveBeenCalledWith(mintUrl, { cancelRefetch: false });
  expect(mockPush).not.toHaveBeenCalled();
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Recheck unreachable mints' }),
  ).toHaveLength(0);
  await act(async () => row.parent!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl },
  });
  delete mockMintErrors[mintUrl];
  await act(async () => {
    useWalletStore.setState({ refreshCounter: 1 });
  });
  expect(
    connectedRow(mintUrl)
      .findAllByType('Text' as any)
      .find((text) => text.props.children === 'Example mint')?.props.color,
  ).toBe('$color');
  expect(connectedRow(mintUrl).parent!.props.opacity).toBe(1);
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Recheck Example mint connection' }),
  ).toHaveLength(0);
  expect(connectedRow(mintUrl).findByType('RollingNumber' as any).props.color).toBe('$color');
  expect(connectedRow(mintUrl).findAllByType('CircleAlert' as any)).toHaveLength(0);
  expect(
    connectedRow(mintUrl)
      .findAllByProps({ accessibilityRole: 'image' })
      .map((badge) => badge.props.accessibilityLabel),
  ).toEqual([]);
});

it('does not mark individual mints down when the device is offline, and keeps hidden balances hidden', async () => {
  const mintUrl = 'https://mint.example';
  mockDeviceOffline = true;
  mockHideBalance = true;
  mockMintErrors[mintUrl] = new Error('Network unavailable');
  useWalletStore.setState({ mints: [{ mintUrl, trusted: true }], balances: { [mintUrl]: 4200 } });
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  expect(connectedRow(mintUrl).findByType('RollingNumber' as any).props).toMatchObject({
    color: '$color',
    children: '****',
    suffix: '',
  });
  expect(connectedRow(mintUrl).findAllByType('CircleAlert' as any)).toHaveLength(0);
  expect(connectedRow(mintUrl).parent!.props.opacity).toBe(1);
  expect(tree.root.findAllByType('AppButton' as any)).toHaveLength(0);
});

it('rechecks only unreachable mints from the header and shows in-flight feedback', async () => {
  const urls = ['https://one.example', 'https://two.example', 'https://healthy.example'];
  useWalletStore.setState({ mints: urls.map((mintUrl) => ({ mintUrl, trusted: true })) });
  mockMintErrors[urls[0]] = new Error('Unreachable');
  mockMintErrors[urls[1]] = new Error('Unreachable');
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  const refresh = () => tree.root.findByProps({ accessibilityLabel: 'Recheck unreachable mints' });
  await act(async () => refresh().props.onPress());
  expect(mockRecheckMint.mock.calls).toEqual([
    [urls[0], { cancelRefetch: false }],
    [urls[1], { cancelRefetch: false }],
  ]);
  mockCheckingMints = [urls[0]];
  await act(async () => {
    useWalletStore.setState({ refreshCounter: 1 });
  });
  expect(refresh().props.loading).toBe(true);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Recheck one.example connection' }).props.loading,
  ).toBe(true);
  expect(connectedRow(urls[2]).parent!.props.opacity).toBe(1);
  delete mockMintErrors[urls[0]];
  await act(async () => {
    useWalletStore.setState({ refreshCounter: 2 });
  });
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Recheck unreachable mints' }),
  ).toHaveLength(0);
});

const render = async () => {
  await act(async () => {
    tree = create(<AddMintScreen />);
  });
};

it('clears an unmatched mint search without changing connected mints', async () => {
  const mintUrl = 'https://mint.example';
  useWalletStore.setState({ mints: [{ mintUrl, name: 'Example', trusted: true }] });
  await render();
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('unmatched'));
  const clear = tree.root
    .findAllByType('AppButton' as any)
    .find((node) => node.props.children === 'Clear search')!;
  expect(clear).toBeDefined();
  await act(async () => clear.props.onPress());
  expect(tree.root.findByType('Input' as any).props.value).toBe('');
  expect(useWalletStore.getState().mints).toEqual([{ mintUrl, name: 'Example', trusted: true }]);
  expect(mockPush).not.toHaveBeenCalled();
});

it('opens the trust sheet when submitting an entered URL, preserving its path', async () => {
  await render();
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('mint.example/Bitcoin/'),
  );
  await act(async () => tree.root.findByType('Input' as any).props.onSubmitEditing());
  expect(tree.root.findByType('TrustSheet' as any).props.title).toBe('Trust this mint?');
  expect(mockPush).not.toHaveBeenCalled();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  expect(
    tree.root.findByType('TrustSheet' as any).findByType('MintImage' as any).props.mintUrl,
  ).toBe('https://mint.example/Bitcoin');
});

it('opens trust directly from the detected URL Add button and adds only after confirmation', async () => {
  await render();
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('https://mint.example'),
  );
  const add = tree.root
    .findAllByType('AppIconButton' as any)
    .find((node) => node.props.accessibilityLabel === 'Add mint')!;
  await act(async () => add.props.onPress());
  expect(mockPush).not.toHaveBeenCalled();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((button) => button.props.children === 'Confirm add')!
      .props.onPress(),
  );
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith('https://mint.example', {
    trusted: true,
  });
  expect(tree.root.findAllByType('TrustSheet' as any)).toHaveLength(0);
});

it('connects an entered mint directly from Add after remembered consent', async () => {
  mockSkipDisclaimer = true;
  await render();
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('mint.example/Bitcoin/'),
  );
  const add = tree.root
    .findAllByType('AppIconButton' as any)
    .find((node) => node.props.accessibilityLabel === 'Add mint')!;
  await act(async () => add.props.onPress());
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith('https://mint.example/Bitcoin', {
    trusted: true,
  });
  expect(useWalletStore.getState().mints).toEqual([
    { mintUrl: 'https://mint.example/Bitcoin', trusted: true },
  ]);
  expect(mockPush).not.toHaveBeenCalled();
});

it('shows button loading and prevents duplicate Add operations for a discovered mint', async () => {
  mockSkipDisclaimer = true;
  const mintUrl = 'https://mint.example/Bitcoin';
  mockDiscoveredMints = [{ url: mintUrl, name: 'Example mint' }];
  let finish!: () => void;
  useWalletStore.setState({
    addMint: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            useWalletStore.setState({ mints: [{ mintUrl, trusted: true }] });
            resolve();
          };
        }),
    ),
  });
  await render();
  const add = () =>
    tree.root
      .findAllByType('AppIconButton' as any)
      .find((node) => node.props.accessibilityLabel?.startsWith('Add '))!;
  const press = add().props.onPress;
  await act(async () => {
    press({ stopPropagation: jest.fn() });
    press({ stopPropagation: jest.fn() });
  });
  expect(add().props).toMatchObject({ loading: true, disabled: true });
  expect(useWalletStore.getState().addMint).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children === 'Added'),
  ).toBe(true);
});

it('keeps validation failures visible and allows retry from the mint list', async () => {
  mockSkipDisclaimer = true;
  mockDiscoveredMints = [{ url: 'https://mint.example', name: 'Example mint' }];
  useWalletStore.setState({
    addMint: jest.fn(async () => {
      useWalletStore.setState({ error: 'Mint validation failed' });
    }),
  });
  await render();
  const add = () =>
    tree.root
      .findAllByType('AppIconButton' as any)
      .find((node) => node.props.accessibilityLabel?.startsWith('Add '))!;
  await act(async () => add().props.onPress({ stopPropagation: jest.fn() }));
  expect(
    tree.root.findAllByProps({ accessibilityRole: 'alert' }).map((node) => node.props.children),
  ).toContain('Mint validation failed');
  expect(add().props).toMatchObject({ loading: false, disabled: false });
  expect(mockPush).not.toHaveBeenCalled();
});

it('opens trust directly for a scanned mint URL and consumes the scanner result', async () => {
  useWalletStore.setState({ scannerResult: 'cashu:https://mint.example/Bitcoin' });
  await render();
  expect(mockPush).not.toHaveBeenCalled();
  expect(
    tree.root.findByType('TrustSheet' as any).findByType('MintImage' as any).props.mintUrl,
  ).toBe('https://mint.example/Bitcoin');
  expect(tree.root.findByType('Input' as any).props.value).toBe('https://mint.example/Bitcoin');
  expect(useWalletStore.getState().scannerResult).toBeNull();
});

it('opens the canonical Mints manager from Home', async () => {
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Manage mints' }).props.onPress(),
  );
  expect(mockPush).toHaveBeenCalledWith('/(modals)/mints');
});

it('manages all mint balances, including untrusted mints, separately from discovery', async () => {
  const mintUrl = 'https://untrusted.example';
  useWalletStore.setState({
    mints: [{ mintUrl, name: 'Old mint', trusted: false }],
    balances: { [mintUrl]: 42 },
  });
  await act(async () => {
    tree = create(<MintsScreen />);
  });
  const row = tree.root.findByProps({ accessibilityLabel: 'Manage Old mint, 42 sat, not trusted' });
  expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).toContain(
    '42 sat',
  );
  await act(async () => row.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl },
  });
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((button) => button.props.children === 'Add mint')!
      .props.onPress(),
  );
  expect(mockPush).toHaveBeenLastCalledWith('/(modals)/add-mint');
  expect(tree.root.findAllByProps({ children: 'Discover mints' })).toHaveLength(0);
});

it('keeps balances hidden in the Mints manager', async () => {
  mockHideBalance = true;
  useWalletStore.setState({
    mints: [{ mintUrl: 'https://private.example', trusted: true }],
    balances: { 'https://private.example': 42 },
  });
  await act(async () => {
    tree = create(<MintsScreen />);
  });
  expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).toContain(
    '****',
  );
  expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).not.toContain(
    '42 sat',
  );
});

it('refreshes both wallet data and connection status from the manager', async () => {
  await act(async () => {
    tree = create(<MintsScreen />);
  });
  await act(async () =>
    tree.root.findByType('ScrollView' as any).props.refreshControl.props.onRefresh(),
  );
  expect(useWalletStore.getState().refreshMintList).toHaveBeenCalledTimes(1);
  expect(useWalletStore.getState().refreshBalance).toHaveBeenCalledTimes(1);
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['mint-metadata'] });
});

it('keeps malformed display metadata from hiding a registered mint', async () => {
  const mintUrl = 'https://metadata.example';
  useWalletStore.setState({ mints: [{ mintUrl, trusted: true }], balances: { [mintUrl]: 42 } });
  mockMintMetadata[mintUrl] = { name: { invalid: true }, icon_url: 123 };
  await act(async () => {
    tree = create(<MintsScreen />);
  });
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Manage metadata.example, 42 sat' }),
  ).toBeDefined();
});

it('keeps Add mint focused on discovery and marks connected directory entries Added', async () => {
  const url = 'https://already.example';
  mockDiscoveredMints = [{ url, name: 'Already added' }];
  useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
  await render();
  expect(tree.root.findByType('Screen' as any).props.options.title).toBe('Add mint');
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toContain('Added');
  expect(labels).not.toContain('Connected Mints');
  expect(tree.root.findAllByType('MintIcon' as any)).toHaveLength(1);
});

it('keeps connected mints in order without recommendation filler or payment badges', async () => {
  const urls = [
    'https://lightning.example',
    'https://chain.example',
    'https://both.example',
    'https://unknown.example',
  ];
  useWalletStore.setState({
    mints: urls.map((mintUrl) => ({ mintUrl, trusted: true })),
  });
  mockMintMetadata = {
    [urls[0]]: { nuts: { '4': { methods: [{ method: 'bolt11', unit: 'sat' }] } } },
    [urls[1]]: { nuts: { '30': { supported: true } } },
    [urls[2]]: {
      nuts: {
        '5': {
          methods: [
            { method: 'bolt11', unit: 'sat' },
            { method: 'onchain', unit: 'sat' },
          ],
        },
      },
    },
  };
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  expect(tree.root.findAllByType('MintImage' as any).map((image) => image.props.mintUrl)).toEqual(
    urls,
  );
  expect(tree.root.findAllByType('AppButton' as any)).toHaveLength(0);
  for (const mintUrl of urls) {
    expect(connectedRow(mintUrl).findAllByProps({ accessibilityRole: 'image' })).toEqual([]);
    await act(async () => connectedRow(mintUrl).parent!.props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(modals)/mint-details',
      params: { mintUrl },
    });
  }
});

it('opens the shared trust sheet for Home suggestions without navigating to preview', async () => {
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  const add = tree.root
    .findAllByType('AppIconButton' as any)
    .find((node) => node.props.accessibilityLabel === `Add ${RECOMMENDED_MINTS[0].name}`)!;
  await act(async () => add.props.onPress());
  expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findByType('TrustSheet' as any).props.title).toBe('Trust this mint?');
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Do not show again' }).props.onPress(),
  );
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((button) => button.props.children === 'Confirm add')!
      .props.onPress(),
  );
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith(RECOMMENDED_MINTS[0].mintUrl, {
    trusted: true,
  });
  expect(mockSkipDisclaimer).toBe(true);
  expect(tree.root.findAllByType('TrustSheet' as any)).toHaveLength(0);
  expect(mockPush).not.toHaveBeenCalled();
});

it('opens trust directly from a discovered mint quick-add button', async () => {
  const url = 'https://discovered.example';
  mockDiscoveredMints = [{ url, name: 'Discovered mint' }];
  await render();
  const add = tree.root.findByProps({ accessibilityLabel: 'Add Discovered mint' });
  await act(async () => add.props.onPress({ stopPropagation: jest.fn() }));
  expect(tree.root.findByType('TrustSheet' as any)).toBeDefined();
  expect(mockPush).not.toHaveBeenCalled();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((button) => button.props.children === 'Confirm add')!
      .props.onPress(),
  );
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith(url, { trusted: true });
});

it('shows Home quick-add progress and prevents duplicates when consent is remembered', async () => {
  mockSkipDisclaimer = true;
  let finish!: () => void;
  const mintUrl = RECOMMENDED_MINTS[0].mintUrl;
  useWalletStore.setState({
    addMint: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            useWalletStore.setState({ mints: [{ mintUrl, trusted: true }] });
            resolve();
          };
        }),
    ),
  });
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  const add = () =>
    tree.root.findByProps({ accessibilityLabel: `Add ${RECOMMENDED_MINTS[0].name}` });
  const press = add().props.onPress;
  await act(async () => {
    press();
    press();
  });
  expect(useWalletStore.getState().addMint).toHaveBeenCalledTimes(1);
  expect(add().props).toMatchObject({ loading: true, disabled: true });
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(tree.root.findAllByType('TrustSheet' as any)).toHaveLength(0);
});

it('makes all discovered mints reachable through Load More', async () => {
  mockDiscoveredMints = Array.from({ length: 36 }, (_, index) => ({
    url: `https://mint${index}.example`,
    name: `Mint ${index}`,
  }));
  await render();
  const visibleMints = () => tree.root.findAllByType('MintIcon' as any);
  const loadMore = () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find(
        (node) =>
          typeof node.props.children === 'string' &&
          node.props.children.startsWith('Load More Mints'),
      );
  expect(visibleMints()).toHaveLength(12);
  await act(async () => loadMore()!.props.onPress());
  expect(visibleMints()).toHaveLength(24);
  await act(async () => loadMore()!.props.onPress());
  expect(visibleMints()).toHaveLength(36);
  expect(loadMore()).toBeUndefined();
});
