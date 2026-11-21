import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AddMintScreen from '~/features/mints/AddMintScreen';
import MintsScreen from '~/features/mints/MintsScreen';
import { useWalletStore } from '~/state/walletStore';
import { ConnectedMintsCard } from '~/features/home/components/ConnectedMintsCard';
import { RECOMMENDED_MINTS } from '~/features/home/components/mintPlaceholders';
import { connectMint } from '~/features/mints/connectMint';
import { hapticService } from '~/services/platform/hapticService';
import { useBUIStore } from '~/state/buiStore';
import { getBUITheme } from '~/shared/ui/BUI/theme';

jest.mock('~/services/platform/hapticService', () => ({
  hapticService: {
    selection: jest.fn(),
    acknowledge: jest.fn(),
    completion: jest.fn(),
    review: jest.fn(),
    reject: jest.fn(),
  },
}));

const mockPush = jest.fn();
let mockWalletTheme = 'dark';
const mockOpenMint = jest.fn();
jest.mock('~/features/mints/hooks/useConnectedMintSheet', () => ({
  useConnectedMintSheet: () => ({ openMint: mockOpenMint, mintSheet: null }),
}));
let mockDiscoveredMints: {
  url: string;
  name: string;
  isTestnet?: boolean;
  radarRank?: number;
  status?: string | null;
}[] = [];
let mockMintMetadata: Record<string, Record<string, unknown>> = {};
let mockMintErrors: Record<string, Error> = {};
let mockDeviceOffline = false;
let mockHideBalance = false;
let mockSkipDisclaimer = false;
const mockRecheckMint = jest.fn();
const mockRefreshDiscovery = jest.fn(async () => ({}));
const mockInvalidateQueries = jest.fn();
let mockCheckingMints: string[] = [];
let mockRemovalEligibility: Record<string, string | null> = {};
const mockRemoveConnected = jest.fn();
jest.mock('~/services/wallet/connectedMintRemoval', () => ({
  inspectConnectedMints: jest.fn(),
  removeConnectedMints: (...args: unknown[]) => mockRemoveConnected(...args),
  mintRemovalMessages: { funds: 'Transfer funds before removing', pending: 'Pending payments' },
}));
const mockRouter = { push: mockPush, canGoBack: () => true, back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Stack: { Screen: 'Screen' } }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('tamagui', () => ({
  useThemeName: () => mockWalletTheme,
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
    queries.map(({ queryKey, select }: any) => ({
      data: mockMintMetadata[queryKey[1]]
        ? select
          ? select(mockMintMetadata[queryKey[1]])
          : mockMintMetadata[queryKey[1]]
        : undefined,
      isPending: false,
      isError: !!mockMintErrors[queryKey[1]],
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
          : queryKey[0] === 'mint-removal'
            ? mockRemovalEligibility
            : undefined,
    isLoading: false,
    refetch: mockRefreshDiscovery,
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
const mockToast = jest.fn();
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: mockToast }) }));
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
jest.mock('~/features/explore/components/MintIcon', () => ({
  MintIcon: 'MintIcon',
  MintIconImage: 'MintIcon',
}));
const mockScrollToOffset = jest.fn();
const mockDiscoveryListRender = jest.fn();
jest.mock('@legendapp/list/react-native', () => ({
  LegendList: require('react').forwardRef(
    ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ...props }: any, ref: any) => {
      mockDiscoveryListRender();
      require('react').useImperativeHandle(ref, () => ({ scrollToOffset: mockScrollToOffset }));
      return require('react').createElement(
        'LegendList',
        { data, renderItem, ...props },
        ListHeaderComponent,
        data.length
          ? data
              .slice(0, 12)
              .map((item: any, index: number) =>
                require('react').createElement(
                  require('react').Fragment,
                  { key: item.url },
                  renderItem({ item, index }),
                ),
              )
          : ListEmptyComponent,
      );
    },
  ),
}));
jest.mock('~/shared/ui/RollingNumber', () => ({ RollingNumber: 'RollingNumber' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/BUI/BUIChip', () => ({
  BUIOutlineChip: (props: any) =>
    require('react').createElement('FilterChip', {
      ...props,
      palette: require('~/shared/ui/BUI/useBUITheme').useBUITheme(),
    }),
}));
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
  mockWalletTheme = 'dark';
  useBUIStore.setState({ appearance: 'dark' });
  mockDiscoveredMints = [];
  mockMintMetadata = {};
  mockMintErrors = {};
  mockDeviceOffline = false;
  mockHideBalance = false;
  mockSkipDisclaimer = false;
  mockCheckingMints = [];
  mockRemovalEligibility = {};
  mockRemoveConnected.mockResolvedValue({ removed: [], blocked: {} });
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
    syncMintsToNostr: jest.fn(),
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
  expect(mockOpenMint).toHaveBeenCalledWith(mintUrl);
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

it('clears search from its inline control and keeps refresh available without a directory heading', async () => {
  mockDiscoveredMints = [{ url: 'https://one.example', name: 'One' }];
  await render();
  expect(tree.root.findAllByProps({ children: 'Discover mints' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Clear mint search' })).toHaveLength(0);
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('One'));
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Clear mint search' }).props.onPress(),
  );
  expect(tree.root.findByType('Input' as any).props.value).toBe('');
  await act(async () =>
    tree.root.findByType('LegendList' as any).props.refreshControl.props.onRefresh(),
  );
  expect(mockRefreshDiscovery).toHaveBeenCalledTimes(1);
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
  expect(tree.root.findByProps({ accessibilityLabel: 'Example mint added' })).toBeDefined();
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
  expect(mockOpenMint).toHaveBeenCalledWith(mintUrl);
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

it('marks connected directory entries with an accessible checkmark and no Added text', async () => {
  const url = 'https://already.example';
  mockDiscoveredMints = [{ url, name: 'Already added' }];
  useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
  await render();
  expect(tree.root.findByType('Screen' as any).props.options.title).toBe('Add mint');
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).not.toContain('Added');
  expect(tree.root.findByProps({ accessibilityLabel: 'Already added added' })).toBeDefined();
  expect(labels).not.toContain('Connected Mints');
  expect(tree.root.findAllByType('MintIcon' as any)).toHaveLength(1);
});

it.each(['offline', 'archived'])(
  'blocks %s directory mints and explains with a toast',
  async (status) => {
    mockDiscoveredMints = [{ url: 'https://unavailable.example', name: 'Unavailable', status }];
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Add Unavailable' })).toHaveLength(0);
    expect(tree.root.findAllByType('CircleOff' as any)).toHaveLength(1);
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: 'Unavailable, unavailable mint' })
        .props.onPress(),
    );
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: 'Why Unavailable is unavailable' })
        .props.onPress({ stopPropagation: jest.fn() }),
    );
    expect(mockToast).toHaveBeenCalledTimes(2);
    expect(mockToast).toHaveBeenLastCalledWith(
      status === 'archived'
        ? 'This mint is no longer active'
        : 'This mint is offline. Try again later.',
      expect.objectContaining({ kind: 'warning' }),
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  },
);

it.each([null, 'online', 'degraded'])('keeps %s directory mints available', async (status) => {
  mockDiscoveredMints = [{ url: 'https://available.example', name: 'Available', status }];
  await render();
  expect(tree.root.findByProps({ accessibilityLabel: 'Add Available' }).props.disabled).toBe(false);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Available' }).props.onPress());
  expect(mockPush).toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
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
    expect(mockOpenMint).toHaveBeenLastCalledWith(mintUrl);
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
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
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

it('rejects an invalid mint URL once without starting a wallet operation', async () => {
  await expect(connectMint('file:///invalid-mint')).rejects.toThrow();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  expect(hapticService.reject).toHaveBeenCalledTimes(1);
  expect(hapticService.completion).not.toHaveBeenCalled();
});

it('passes the full directory to the virtual list and keeps later mint actions reachable', async () => {
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
  const list = tree.root.findByType('LegendList' as any);
  expect(list.props.data).toHaveLength(36);
  const last = list.props.data[35];
  const laterRow = list.props.renderItem({ item: last, index: 35 });
  laterRow.props.onPress(last.url);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-profile',
    params: { url: last.url },
  });
  expect(loadMore()).toBeUndefined();
});

it('does not rerender discovery for unrelated wallet balance updates', async () => {
  mockDiscoveredMints = [{ url: 'https://one.example', name: 'One' }];
  await render();
  const renders = mockDiscoveryListRender.mock.calls.length;
  await act(async () => {
    useWalletStore.setState({ balance: 123, refreshCounter: 1 });
  });
  expect(mockDiscoveryListRender).toHaveBeenCalledTimes(renders);
});

it('combines on-chain, testnuts, active and search filters and can toggle them off', async () => {
  mockDiscoveredMints = [
    { url: 'https://normal.example', name: 'Normal' },
    { url: 'https://test-chain.example', name: 'Test chain', isTestnet: true, status: 'online' },
    { url: 'https://connected-chain.example', name: 'Connected', status: 'offline' },
    { url: 'https://test-ln.example', name: 'Test Lightning', isTestnet: true, status: 'online' },
  ];
  for (const mint of mockDiscoveredMints) mockMintMetadata[mint.url] = { nuts: {} };
  mockMintMetadata['https://test-chain.example'] = { nuts: { '30': { supported: true } } };
  mockMintMetadata['https://connected-chain.example'] = {
    nuts: {
      '4': { methods: [{ method: 'onchain' }] },
      '5': { methods: [{ method: 'onchain' }] },
    },
  };
  useWalletStore.setState({
    mints: [{ mintUrl: 'https://connected-chain.example/', trusted: true }],
  });
  await render();
  const shown = () =>
    tree.root.findByType('LegendList' as any).props.data.map((mint: any) => mint.name);
  const chip = (label: string) =>
    tree.root.findAllByType('FilterChip' as any).find((node) => node.props.children === label)!;
  expect(shown()).toHaveLength(4);
  await act(async () => chip('On-chain').props.onPress());
  expect(shown()).toEqual(['Test chain', 'Connected']);
  await act(async () => chip('Active mints').props.onPress());
  expect(shown()).toEqual(['Test chain']);
  await act(async () => chip('Testnuts').props.onPress());
  expect(shown()).toEqual(['Test chain']);
  await act(async () => chip('On-chain').props.onPress());
  expect(shown()).toEqual(['Test chain', 'Test Lightning']);
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Lightning'));
  expect(shown()).toEqual(['Test Lightning']);
});

it('includes connected online mints in Active mints and excludes unknown or inactive status', async () => {
  mockDiscoveredMints = ['online', 'offline', 'archived', 'degraded', null].map(
    (status, index) => ({
      url: `https://mint${index}.example`,
      name: `Mint ${index}`,
      status,
    }),
  );
  useWalletStore.setState({ mints: [{ mintUrl: 'https://mint0.example', trusted: true }] });
  await render();
  const chip = () =>
    tree.root
      .findAllByType('FilterChip' as any)
      .find((node) => node.props.children === 'Active mints')!;
  await act(async () => chip().props.onPress());
  expect(
    tree.root.findByType('LegendList' as any).props.data.map((mint: any) => mint.name),
  ).toEqual(['Mint 0']);
  await act(async () => chip().props.onPress());
  expect(tree.root.findByType('LegendList' as any).props.data).toHaveLength(5);
});

it('clears an empty filter combination and retries failed on-chain checks', async () => {
  mockDiscoveredMints = [{ url: 'https://unknown.example', name: 'Unknown' }];
  mockMintErrors['https://unknown.example'] = new Error('Offline');
  await render();
  const chip = (label: string) =>
    tree.root.findAllByType('FilterChip' as any).find((node) => node.props.children === label)!;
  await act(async () => chip('On-chain').props.onPress());
  const button = (label: string) =>
    tree.root.findAllByType('AppButton' as any).find((node) => node.props.children === label)!;
  await act(async () => button('Retry').props.onPress());
  expect(mockRefreshDiscovery).toHaveBeenCalledTimes(1);
  expect(mockRecheckMint).toHaveBeenCalledWith('https://unknown.example', {
    cancelRefetch: false,
  });
  await act(async () => button('Clear filters').props.onPress());
  expect(chip('On-chain').props.selected).toBe(false);
  expect(tree.root.findByType('LegendList' as any).props.data).toHaveLength(1);
});

it.each(['light', 'dark'] as const)(
  'keeps discovery filter pills on the wallet %s theme when BUI differs',
  async (appearance) => {
    mockWalletTheme = appearance;
    const preview = appearance === 'light' ? 'dark' : 'light';
    useBUIStore.setState({ appearance: preview });
    await render();
    for (const pill of tree.root.findAllByType('FilterChip' as any)) {
      expect(pill.props.palette.canvas).toBe(getBUITheme(appearance).canvas);
      expect(pill.props.palette.text).toBe(getBUITheme(appearance).text);
    }
    expect(useBUIStore.getState().appearance).toBe(preview);
  },
);

it('sorts ranked mints, highlights the top three and preserves source ranks when searching', async () => {
  mockDiscoveredMints = [
    { url: 'https://four.example', name: 'Four', radarRank: 4 },
    { url: 'https://unranked.example', name: 'Unranked' },
    { url: 'https://two.example', name: 'Two', radarRank: 2 },
    { url: 'https://one.example', name: 'One', radarRank: 1 },
    { url: 'https://three.example', name: 'Three', radarRank: 3 },
  ];
  await render();
  const ranked = () =>
    tree.root
      .findAllByType('FilterChip' as any)
      .find((node) => node.props.children === 'Top ranked')!;
  await act(async () => ranked().props.onPress());
  const list = () => tree.root.findByType('LegendList' as any);
  expect(list().props.data.map((mint: any) => mint.radarRank)).toEqual([1, 2, 3, 4]);
  expect(
    tree.root.findAllByProps({ children: 'Ranked by Mint Radar reliability score' }),
  ).toHaveLength(1);
  for (const [name, color] of [
    ['One', '$green11'],
    ['Two', '$cyan11'],
    ['Three', '$orange11'],
  ] as const) {
    expect(
      tree.root.findAllByType('Text' as any).find((text) => text.props.children === name)?.props
        .color,
    ).toBe(color);
  }
  expect(tree.root.findByProps({ accessibilityLabel: 'Rank 1' }).props.bg).toBeUndefined();
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Four'));
  expect(list().props.data.map((mint: any) => mint.radarRank)).toEqual([4]);
  await act(async () => ranked().props.onPress());
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Rank 4' })).toHaveLength(0);
});

it.each([false, true])(
  'selects eligible connected rows and gives aggregate removal feedback (partial: %s)',
  async (partial) => {
    const empty = 'https://empty.example';
    const funded = 'https://funded.example';
    useWalletStore.setState({
      mints: [
        { mintUrl: empty, name: 'Empty mint', trusted: true },
        { mintUrl: funded, name: 'Funded mint', trusted: true },
      ],
      balances: { [empty]: 0, [funded]: 10 },
    });
    mockRemovalEligibility = { [empty]: null, [funded]: 'funds' };
    await act(async () => {
      tree = create(<MintsScreen />);
    });
    let header!: ReactTestRenderer;
    await act(async () => {
      header = create(tree.root.findByType('Screen' as any).props.options.headerRight());
    });
    expect(header.root.findByType('AppIconButton' as any).props.accessibilityLabel).toBe(
      'Select mints',
    );
    await act(async () => header.root.findByType('AppIconButton' as any).props.onPress());
    const row = (name: string) =>
      tree.root
        .findAllByType('AppPressable' as any)
        .find((node) => node.props.accessibilityLabel?.startsWith(name))!;
    await act(async () => row('Empty mint').props.onPress());
    expect(row('Empty mint').props.accessibilityState.checked).toBe(true);
    await act(async () => row('Funded mint').props.onPress());
    expect(row('Funded mint').props.accessibilityState.checked).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    const clear = tree.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Clear selection')!;
    await act(async () => clear.props.onPress());
    expect(row('Empty mint').props.accessibilityState.checked).toBe(false);
    const selectAll = tree.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Select all')!;
    await act(async () => selectAll.props.onPress());
    const review = tree.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Remove selected (1)')!;
    await act(async () => review.props.onPress());
    expect(mockRemoveConnected).not.toHaveBeenCalled();
    mockRemoveConnected.mockResolvedValue(
      partial ? { removed: [], blocked: { [empty]: 'funds' } } : { removed: [empty], blocked: {} },
    );
    await act(async () =>
      tree.root
        .findAllByType('AppButton' as any)
        .find((node) => node.props.children === 'Confirm removal')!
        .props.onPress(),
    );
    expect(mockRemoveConnected).toHaveBeenCalledWith([empty]);
    expect(hapticService.selection).toHaveBeenCalledTimes(3);
    expect(hapticService.completion).toHaveBeenCalledTimes(partial ? 0 : 1);
    expect(hapticService.review).toHaveBeenCalledTimes(partial ? 1 : 0);
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => header.unmount());
  },
);
