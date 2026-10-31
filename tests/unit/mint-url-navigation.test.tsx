import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AddMintScreen from '~/features/mints/AddMintScreen';
import { useWalletStore } from '~/state/walletStore';
import { ConnectedMintsCard } from '~/features/home/components/ConnectedMintsCard';
import { RECOMMENDED_MINTS } from '~/features/home/components/mintPlaceholders';

const mockPush = jest.fn();
let mockDiscoveredMints: { url: string; name: string }[] = [];
let mockMintMetadata: Record<string, Record<string, unknown>> = {};
let mockMintErrors: Record<string, Error> = {};
let mockDeviceOffline = false;
let mockHideBalance = false;
const mockRecheckMint = jest.fn();
let mockCheckingMints: string[] = [];
const mockRouter = { push: mockPush, canGoBack: () => true, back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Stack: { Screen: 'Screen' } }));
jest.mock('tamagui', () => ({
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
  useQueryClient: () => ({}),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({
    primaryCurrency: 'SATS',
    secondaryCurrency: 'NONE',
    hideBalance: mockHideBalance,
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
  mockCheckingMints = [];
  useWalletStore.setState({
    mints: [],
    balances: {},
    refreshCounter: 0,
    scannerResult: null,
    setScannerResult: (scannerResult) => useWalletStore.setState({ scannerResult }),
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
  expect(row.findByType('Text' as any).props.color).toBe('$color');
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
  expect(connectedRow(mintUrl).findByType('Text' as any).props.color).toBe('$color');
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

it('opens the full profile when submitting an entered URL, preserving its path', async () => {
  await render();
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('mint.example/Bitcoin/'),
  );
  await act(async () => tree.root.findByType('Input' as any).props.onSubmitEditing());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-profile',
    params: { url: 'https://mint.example/Bitcoin' },
  });
});

it('opens the profile from the detected URL Add button', async () => {
  await render();
  await act(async () =>
    tree.root.findByType('Input' as any).props.onChangeText('https://mint.example'),
  );
  const add = tree.root
    .findAllByType('AppButton' as any)
    .find((node) => node.props.children === 'Add')!;
  await act(async () => add.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-profile',
    params: { url: 'https://mint.example' },
  });
});

it('opens a scanned mint URL once and consumes the scanner result', async () => {
  useWalletStore.setState({ scannerResult: 'cashu:https://mint.example/Bitcoin' });
  await render();
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-profile',
    params: { url: 'https://mint.example/Bitcoin' },
  });
  expect(useWalletStore.getState().scannerResult).toBeNull();
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

it('sends Home recommendations through the same profile and consent flow', async () => {
  await act(async () => {
    tree = create(<ConnectedMintsCard />);
  });
  const add = tree.root
    .findAllByType('AppButton' as any)
    .find((node) => node.props.children === 'Add')!;
  await act(async () => add.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-profile',
    params: { url: RECOMMENDED_MINTS[0].mintUrl },
  });
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
