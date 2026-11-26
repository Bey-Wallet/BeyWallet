import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ExpandableWallet } from '~/features/home/components/ExpandableWallet';
import { HomeTabScreen } from '~/features/home';
import { useSettingsStore } from '~/state/settingsStore';
import { appDimensions, appSpacing } from '~/shared/theme/appearance';

jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
const mockRefreshBalance = jest.fn(async () => {});
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) => selector({ refreshBalance: mockRefreshBalance, error: null }),
}));
jest.mock('~/state/lightningAddressStore', () => ({
  useLightningAddressStore: (selector: any) => selector({ pending: [] }),
}));
jest.mock('~/state/authStore', () => ({ useAuthStore: () => ({ lock: jest.fn() }) }));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: { getState: () => ({ loadPendingRequests: async () => {} }) },
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 1 },
}));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ showFeedback: jest.fn() }),
}));
jest.mock('~/shared/ui/StatusScreen', () => 'StatusScreen');
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/icons/BeyIcon', () => 'BeyIcon');
jest.mock('~/shared/icons', () => ({ ChevronRight: 'ChevronRight', Zap: 'Zap' }));
jest.mock('tamagui', () => ({
  ...Object.fromEntries(
    ['YStack', 'XStack', 'View', 'ScrollView', 'Text'].map((name) => [name, name]),
  ),
  useTheme: () => ({ iconSecondary: { val: '#888' }, background: { val: '#000' } }),
}));
jest.mock('~/features/home/components/WalletCard', () => ({
  __esModule: true,
  default: 'Balance',
}));
jest.mock('~/features/home/components/ActionButtons', () => ({
  __esModule: true,
  default: 'Actions',
}));
jest.mock('~/features/home/components/ConnectedMintsCard', () => ({
  __esModule: true,
  default: 'Mints',
}));
jest.mock('~/features/home/components/NostrActivity', () => ({
  __esModule: true,
  default: 'Activity',
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ homeExpanded: false });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const wallet = () => tree.root.findByProps({ testID: 'expandable-wallet' });
const content = () => tree.root.findByProps({ testID: 'home-content' });

it('renders saved expansion at full height on the very first render, without a layout callback', async () => {
  useSettingsStore.setState({ homeExpanded: true });
  await act(async () => {
    tree = create(<ExpandableWallet availableHeight={640} />);
  });
  expect(wallet().props.height).toBe(640);
  expect(wallet().props.onLayout).toBeUndefined();
  expect(tree.root.findByProps({ testID: 'balance-area' }).props.flex).toBe(1);
});

it('changes layout only from Settings without remounting the balance or actions', async () => {
  await act(async () => {
    tree = create(<ExpandableWallet availableHeight={640} />);
  });
  expect(wallet().props.height).toBeUndefined();
  const balance = tree.root.findByType('Balance' as any);
  const actions = tree.root.findByType('Actions' as any);
  await act(async () => useSettingsStore.setState({ homeExpanded: true }));
  expect(wallet().props.height).toBe(640);
  expect(tree.root.findByType('Balance' as any)).toBe(balance);
  expect(tree.root.findByType('Actions' as any)).toBe(actions);
  const area = tree.root.findByProps({ testID: 'balance-area' });
  expect(area.props.onPress).toBeUndefined();
  expect(area.props.onAccessibilityAction).toBeUndefined();
  await act(async () => useSettingsStore.setState({ homeExpanded: false }));
  expect(wallet().props.height).toBeUndefined();
});

it('updates the expanded height directly on viewport resize', async () => {
  useSettingsStore.setState({ homeExpanded: true });
  await act(async () => {
    tree = create(<ExpandableWallet availableHeight={640} />);
  });
  await act(async () => tree.update(<ExpandableWallet availableHeight={480} />));
  expect(wallet().props.height).toBe(480);
});

it('never exposes collapsed Home before viewport measurement, including when remounted after Done', async () => {
  useSettingsStore.setState({ homeExpanded: true });
  for (let mount = 0; mount < 2; mount++) {
    await act(async () => {
      tree = create(<HomeTabScreen />);
    });
    expect(content().props.opacity).toBe(0);
    await act(async () =>
      tree.root.findByType('ScrollView' as any).props.onLayout({
        nativeEvent: { layout: { height: 800 } },
      }),
    );
    const expected = 800 - appDimensions.bar - 20 - appSpacing.page;
    expect(content().props.opacity).toBe(1);
    expect(wallet().props.height).toBe(expected);
    expect(tree.root.findByProps({ testID: 'home-mint-page' }).props.minHeight).toBe(expected);
    await act(async () => tree.unmount());
  }
});

it('keeps the expanded layout and mounted balance during refresh', async () => {
  useSettingsStore.setState({ homeExpanded: true });
  await act(async () => {
    tree = create(<HomeTabScreen />);
  });
  const scroll = () => tree.root.findByType('ScrollView' as any);
  await act(async () => scroll().props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  const before = wallet().props.height;
  const balance = tree.root.findByType('Balance' as any);
  await act(async () => scroll().props.onLayout({ nativeEvent: { layout: { height: 0 } } }));
  expect(wallet().props.height).toBe(before);
  await act(async () => scroll().props.refreshControl.props.onRefresh());
  expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
  expect(content().props.opacity).toBe(1);
  expect(wallet().props.height).toBe(before);
  expect(tree.root.findByType('Balance' as any)).toBe(balance);
});
