import React from 'react';
import { FlatList, Modal } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import HomeHeaderMintSelector, {
  MintSelectorSheet,
  type MintSelectorSheetProps,
} from '~/shared/ui/HomeMintSelector';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';

const a = 'https://alpha.example';
const b = 'https://beta.example';
const c = 'https://untrusted.example';
const d = 'https://lightning.example';
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockRefresh = jest.fn();
const mockPush = jest.fn();
const mockGetAllMints = jest.fn();
const mockGetMintInfo = jest.fn();
const mockFetchPrice = jest.fn();
let mockCachedPrice: { price: number; updatedAt: number; change24h: number } | null = null;
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/services/wallet/mintManager', () => ({
  mintManager: {
    getAllMints: (...args: unknown[]) => mockGetAllMints(...args),
    getMintInfo: (...args: unknown[]) => mockGetMintInfo(...args),
  },
}));
jest.mock('~/services/api/bitcoinService', () => ({
  bitcoinService: {
    getCachedPrice: () => mockCachedPrice,
    fetchPrice: (...args: unknown[]) => mockFetchPrice(...args),
  },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: false, isInternetReachable: false }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['Text', 'YStack', 'XStack', 'View', 'Avatar', 'Square', 'Input'].map((name) => [name, name]),
  ),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    ['Check', 'ChevronDown', 'Sprout', 'Plus', 'Landmark', 'X', 'Search'].map((name) => [
      name,
      name,
    ]),
  ),
);
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));

let tree: ReactTestRenderer;
let client: QueryClient;
let ref: React.RefObject<AppBottomSheetRef | null>;
const originalFrame = global.requestAnimationFrame;
const originalCancel = global.cancelAnimationFrame;
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const advance = async (ms = 40) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};
const row = (url: string) =>
  tree.root
    .findAllByType('AppPressable' as any)
    .find(
      (node) =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.findAllByType('MintImage' as any).some((icon) => icon.props.mintUrl === url),
    )!;
const list = () => tree.root.findByType(FlatList);
const sheet = () => tree.root.findByType(Modal);
const press = async (url: string) => {
  await act(async () => {
    void row(url).props.onPress();
  });
};
const render = async (props: MintSelectorSheetProps = {}, home = false) => {
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        {home ? (
          <HomeHeaderMintSelector />
        ) : (
          <MintSelectorSheet
            ref={ref}
            {...props}
            onOpenChange={(open) => {
              if (open) mockPresent();
              else mockDismiss();
              props.onOpenChange?.(open);
            }}
          />
        )}
      </QueryClientProvider>,
    );
  });
  if (!home) await act(async () => ref.current?.present());
  await advance(1);
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(Date.now()), 16) as unknown as number;
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  ref = React.createRef<AppBottomSheetRef>();
  mockCachedPrice = null;
  mockFetchPrice.mockRejectedValue(new Error('Offline'));
  mockGetAllMints.mockResolvedValue([
    { mintUrl: a, mintInfo: { nuts: { '4': { methods: [{ method: 'bolt11', unit: 'sat' }] } } } },
    { mintUrl: b, mintInfo: { nuts: { '30': { supported: true } } } },
    { mintUrl: c, mintInfo: { nuts: { '30': { supported: true } } } },
    { mintUrl: d, mintInfo: { nuts: { '5': { methods: [{ method: 'bolt11', unit: 'sat' }] } } } },
  ]);
  useWalletStore.setState({
    activeMintUrl: a,
    mints: [
      { mintUrl: a, name: 'Alpha', trusted: true },
      { mintUrl: b, name: 'Beta', trusted: true },
      { mintUrl: c, name: 'Untrusted', trusted: false },
      { mintUrl: d, name: 'Lightning', trusted: true },
    ],
    balances: { [a]: 10_000, [b]: 0, [c]: 30, [d]: 500 },
    setActiveMint: jest.fn((url) => {
      useWalletStore.setState({ activeMintUrl: url });
    }),
    refreshMintList: mockRefresh,
    isInitializing: false,
    isRefreshing: false,
  });
  useSettingsStore.setState({
    primaryCurrency: 'SATS',
    secondaryCurrency: 'USD',
    hideBalance: false,
    showBitcoinSymbol: false,
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  client.clear();
  onlineManager.setOnline(true);
  global.requestAnimationFrame = originalFrame;
  global.cancelAnimationFrame = originalCancel;
  jest.useRealTimers();
});

it('opens cached mints offline without refreshing the list or waiting for network activity', async () => {
  onlineManager.setOnline(false);
  useWalletStore.setState({ isRefreshing: true });
  await render({}, true);
  const trigger = tree.root
    .findAllByType('AppPressable' as any)
    .find((node) => node.props.accessibilityState?.expanded !== undefined)!;
  expect(trigger.props.disabled).toBe(false);
  await act(async () => trigger.props.onPress());
  expect(sheet().props.visible).toBe(true);
  expect(trigger.props.accessibilityState.expanded).toBe(true);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockGetMintInfo).not.toHaveBeenCalled();
  expect(mockFetchPrice).not.toHaveBeenCalled();
  expect(list().props.data).toHaveLength(4);
  expect(row(a).props.accessibilityLabel).toBe('Alpha, 10,000 sat');
  expect(row(b).props.accessibilityLabel).toBe('Beta, 0 sat');
});

it('uses a full-screen native modal and searches cached mint names and URLs', async () => {
  await render();
  expect(sheet().props).toMatchObject({
    visible: true,
    presentationStyle: 'fullScreen',
    animationType: 'slide',
  });
  const search = () => tree.root.findByProps({ accessibilityLabel: 'Search mints' });
  await act(async () => search().props.onChangeText('BETA'));
  expect(list().props.data.map((mint: any) => mint.url)).toEqual([b]);
  await act(async () => search().props.onChangeText('alpha.example'));
  expect(list().props.data.map((mint: any) => mint.url)).toEqual([a]);
  await act(async () => search().props.onChangeText('missing'));
  expect(list().props.data).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'No mints match your search.'),
  ).toBe(true);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Clear mint search' }).props.onPress(),
  );
  expect(list().props.data).toHaveLength(4);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockGetMintInfo).not.toHaveBeenCalled();
});

it('closes with Android Back, reports visibility and clears search when reopened', async () => {
  const onOpenChange = jest.fn();
  await render({ onOpenChange });
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Search mints' }).props.onChangeText('beta'),
  );
  await act(async () => sheet().props.onRequestClose!());
  expect(sheet().props.visible).toBe(false);
  await act(async () => ref.current!.present());
  expect(sheet().props.visible).toBe(true);
  expect(tree.root.findByProps({ accessibilityLabel: 'Search mints' }).props.value).toBe('');
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
});

it('dismisses an unchanged Home selection without starting another refresh', async () => {
  await render();
  await press(a);
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(useWalletStore.getState().setActiveMint).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
});

it('shows the row spinner until the switch commits, then a bold branded check before closing', async () => {
  onlineManager.setOnline(false);
  const operation = deferred();
  const switchMint = jest.fn(async (url: string) => {
    await operation.promise;
    useWalletStore.setState({ activeMintUrl: url });
  });
  useWalletStore.setState({ setActiveMint: switchMint });
  await render();
  await press(b);
  expect(row(b).findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'Close mint selector' }).props.disabled).toBe(
    true,
  );
  await act(async () => sheet().props.onRequestClose!());
  expect(sheet().props.visible).toBe(true);
  await act(async () => {
    ref.current?.dismiss();
  });
  await press(a);
  await advance();
  expect(switchMint).toHaveBeenCalledTimes(1);
  expect(switchMint).toHaveBeenCalledWith(b);
  expect(mockDismiss).not.toHaveBeenCalled();
  operation.resolve();
  await advance(0);
  expect(row(b).props.accessibilityState.selected).toBe(true);
  expect(row(b).findAllByType('Spinner' as any)).toHaveLength(0);
  expect(row(b).findByType('Check' as any).props).toMatchObject({
    color: '$buttonBrandedPrimary',
    strokeWidth: 3.5,
  });
  expect(mockDismiss).not.toHaveBeenCalled();
  await advance();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('awaits a flow selection without changing the home mint or allowing early dismissal', async () => {
  const operation = deferred();
  const onSelect = jest.fn(async () => {
    ref.current?.dismiss();
    await operation.promise;
  });
  await render({ activeMintUrl: a, changeGlobalActiveMint: false, onSelect });
  await press(b);
  await advance();
  expect(onSelect).toHaveBeenCalledWith(b);
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(useWalletStore.getState().setActiveMint).not.toHaveBeenCalled();
  expect(useWalletStore.getState().activeMintUrl).toBe(a);
  operation.resolve();
  await advance();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('keeps the sheet open and permits retry after a failed switch', async () => {
  useWalletStore.setState({
    setActiveMint: jest.fn(() => {
      throw new Error('Could not switch mint');
    }),
  });
  await render();
  await press(b);
  await advance();
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(sheet().props.visible).toBe(true);
  expect(tree.root.findByProps({ accessibilityLabel: 'Close mint selector' }).props.disabled).toBe(
    false,
  );
  expect(row(b).props.disabled).toBe(false);
  expect(row(b).props.accessibilityState.selected).toBe(false);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Could not switch mint',
  );
});

it('enforces trust, allowed URLs and payment methods using SDK metadata while offline', async () => {
  onlineManager.setOnline(false);
  await render({
    method: 'melt-onchain',
    allowedMintUrls: [b, c, d],
    changeGlobalActiveMint: false,
  });
  expect(mockGetAllMints).toHaveBeenCalledTimes(1);
  expect(mockGetMintInfo).not.toHaveBeenCalled();
  expect(list().props.data.map((item: any) => item.url)).toEqual([b]);
  await act(async () => {
    ref.current?.present();
  });
  expect(mockGetAllMints).toHaveBeenCalledTimes(1);
});

it('checks the mint is still eligible before applying a selection', async () => {
  await render({ trustedOnly: true });
  await press(b);
  await act(async () => {
    useWalletStore.setState({
      mints: useWalletStore.getState().mints.filter((mint) => mint.mintUrl !== b),
    });
  });
  await advance();
  expect(useWalletStore.getState().setActiveMint).not.toHaveBeenCalled();
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'no longer available',
  );
});

it('uses the saved primary fiat conversion offline and respects hidden balances', async () => {
  onlineManager.setOnline(false);
  mockCachedPrice = { price: 100_000, change24h: 0, updatedAt: Date.now() / 1000 };
  useSettingsStore.setState({ primaryCurrency: 'FIAT' });
  await render();
  expect(row(a).props.accessibilityLabel).toBe('Alpha, $10.00');
  expect(row(b).props.accessibilityLabel).toBe('Beta, $0.00');
  expect(mockFetchPrice).not.toHaveBeenCalled();
  await act(async () => {
    useSettingsStore.setState({ hideBalance: true });
  });
  expect(row(a).props.accessibilityLabel).toBe('Alpha, ****');
});

it('shows sats instead of inventing a fiat value when no exchange rate is saved', async () => {
  onlineManager.setOnline(false);
  useSettingsStore.setState({ primaryCurrency: 'FIAT' });
  await render();
  expect(row(a).props.accessibilityLabel).toBe('Alpha, 10,000 sat');
  expect(row(b).props.accessibilityLabel).toBe('Beta, $0.00');
});

it('uses sats for None with a saved FIAT preference without fetching quotes while online', async () => {
  useSettingsStore.setState({ primaryCurrency: 'FIAT', secondaryCurrency: 'NONE' });
  await render();
  expect(row(a).props.accessibilityLabel).toBe('Alpha, 10,000 sat');
  expect(row(b).props.accessibilityLabel).toBe('Beta, 0 sat');
  expect(mockFetchPrice).not.toHaveBeenCalled();
  await act(async () => useSettingsStore.setState({ showBitcoinSymbol: true }));
  expect(row(a).props.accessibilityLabel).toBe('Alpha, ₿10,000');
  expect(mockFetchPrice).not.toHaveBeenCalled();
});

it('selects all mints as a filter without changing the active mint', async () => {
  const onSelect = jest.fn();
  await render({ showAllOption: true, onSelect });
  const all = tree.root.findByProps({ accessibilityLabel: 'All mints, 10,530 sat' });
  await act(async () => {
    void all.props.onPress();
  });
  await advance(80);
  expect(onSelect).toHaveBeenCalledWith('all');
  expect(useWalletStore.getState().setActiveMint).not.toHaveBeenCalled();
  expect(useWalletStore.getState().activeMintUrl).toBe(a);
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});
