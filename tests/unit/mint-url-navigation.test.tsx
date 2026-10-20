import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AddMintScreen from '~/features/mints/AddMintScreen';
import { useWalletStore } from '~/state/walletStore';
import { ConnectedMintsCard } from '~/features/home/components/ConnectedMintsCard';
import { RECOMMENDED_MINTS } from '~/features/home/components/mintPlaceholders';

const mockPush = jest.fn();
let mockDiscoveredMints: { url: string; name: string }[] = [];
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
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === 'all-mint-recommendations' ? mockDiscoveredMints : undefined,
    isLoading: false,
  }),
  useQueryClient: () => ({}),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({ primaryCurrency: 'SATS', secondaryCurrency: 'NONE' }),
}));
jest.mock('~/services/wallet/currencyService', () => ({ currencyService: {} }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/api/mintRecommendationService', () => ({ mintRecommendationService: {} }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));
jest.mock('~/features/explore/components/MintIcon', () => ({ MintIcon: 'MintIcon' }));
jest.mock('~/shared/ui/RollingNumber', () => ({ RollingNumber: 'RollingNumber' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
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
  useWalletStore.setState({
    mints: [],
    balances: {},
    scannerResult: null,
    setScannerResult: (scannerResult) => useWalletStore.setState({ scannerResult }),
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
const render = async () => {
  await act(async () => {
    tree = create(<AddMintScreen />);
  });
};

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
