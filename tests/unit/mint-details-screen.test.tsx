import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import MintDetailsScreen from '~/features/mints/MintDetailsScreen';
import { useWalletStore } from '~/state/walletStore';
import { useQuery } from '@tanstack/react-query';

const url = 'https://mint.example/Bitcoin';
const mockPush = jest.fn();
const mockSheetPresent = jest.fn();
const mockRecheckConnection = jest.fn();
let mockEditName: string | undefined;
const mockToast = { show: jest.fn() };
const mockSettings = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'USD',
  showBitcoinSymbol: false,
};
const mockRouter = { push: mockPush, canGoBack: () => true, back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ mintUrl: url, editName: mockEditName }),
  Stack: {
    Screen: ({ options }: any) => (
      <>
        {options.headerLeft?.()}
        {options.headerTitle?.()}
        {options.headerRight?.()}
      </>
    ),
  },
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['YStack', 'XStack', 'Text', 'ScrollView', 'View', 'Separator', 'Input'].map((name) => [
      name,
      name,
    ]),
  ),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'ChevronLeft',
      'Share2',
      'QrCode',
      'Pencil',
      'Check',
      'ChevronDown',
      'ChevronUp',
      'ExternalLink',
      'ArrowDownToLine',
      'ArrowUpFromLine',
      'ArrowRightLeft',
      'AlertTriangle',
      'Trash2',
      'RefreshCw',
    ].map((name) => [name, name]),
  ),
);
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: any) => ({
    data:
      queryKey[0] === 'bitcoinPrice'
        ? { price: 100000 }
        : {
            name: 'Original mint',
            description: 'Community mint',
            motd: 'Welcome',
            version: 'cdk/0.18',
            nuts: { '4': { methods: [{ method: 'bolt11', unit: 'sat' }] } },
          },
    isFetching: false,
    error: null,
    dataUpdatedAt: 1000,
    errorUpdatedAt: 0,
    refetch: mockRecheckConnection,
  })),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => mockSettings,
}));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { convertSatsToCurrency: () => 0, formatValue: () => '0 USD' },
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/api/mintHealthService', () => ({ mintHealthService: {} }));
jest.mock('~/features/mints/components/MintPreviewHealth', () => ({
  MintReliabilityRow: 'MintReliabilityRow',
  MintPreviewHealth: 'MintPreviewHealth',
}));
jest.mock('~/features/mints/components/MintOverview', () => ({ MintOverview: 'MintOverview' }));
jest.mock('~/features/mints/components/MintPreviewMethods', () => ({
  MintPreviewMethods: 'MintPreviewMethods',
  mintPreviewMethods: () => [{ unit: 'sat' }],
}));
jest.mock('~/features/mints/components/MintUrlQrOverlay', () => ({
  MintUrlQrOverlay: 'MintUrlQrOverlay',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/Flex', () => ({ SafeFlex: 'SafeFlex' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: mockSheetPresent,
      dismiss: jest.fn(),
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
}));

let tree: ReactTestRenderer;
const iconButton = (label: string) =>
  tree.root
    .findAllByType('AppIconButton' as any)
    .find((node) => node.props.accessibilityLabel === label)!;
const render = async () => {
  await act(async () => {
    tree = create(<MintDetailsScreen />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSettings, {
    primaryCurrency: 'SATS',
    secondaryCurrency: 'USD',
    showBitcoinSymbol: false,
  });
  mockEditName = undefined;
  useWalletStore.setState({
    mints: [{ mintUrl: url, nickname: 'My mint', name: 'Original mint', trusted: true }],
    balances: { [url]: 0 },
    activeMintUrl: url,
    error: null,
    setActiveMint: jest.fn(),
    removeMint: jest.fn(),
    setMintNickname: jest.fn(async (_, nickname) => {
      useWalletStore.setState({
        mints: [{ mintUrl: url, nickname, name: 'Original mint', trusted: true }],
      });
    }),
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('shows only a sats balance for None with FIAT saved and restores fiat when selected again', async () => {
  Object.assign(mockSettings, { primaryCurrency: 'FIAT', secondaryCurrency: 'NONE' });
  useWalletStore.setState({ balances: { [url]: 10000 } });
  await render();
  const fiatLabels = () =>
    tree.root.findAllByType('Text' as any).filter((node) => node.props.children === '0 USD');
  expect(fiatLabels()).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some(
        (node) =>
          node.props.children === 10000 ||
          (Array.isArray(node.props.children) && node.props.children.includes('10,000')),
      ),
  ).toBe(true);
  expect(useQuery).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: ['bitcoinPrice', 'NONE'], enabled: false }),
  );
  mockSettings.secondaryCurrency = 'USD';
  await act(async () => tree.update(<MintDetailsScreen />));
  expect(fiatLabels().length).toBeGreaterThan(0);
  expect(mockSettings.primaryCurrency).toBe('FIAT');
});

it('edits the header name inline and saves its trimmed nickname on the check button', async () => {
  await render();
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  expect(iconButton('Edit mint name').props.iconSize).toBe(22);
  await act(async () => iconButton('Edit mint name').props.onPress());
  const input = tree.root.findByType('Input' as any);
  expect(input.props.defaultValue).toBe('My mint');
  await act(async () => input.props.onChangeText('  Personal mint  '));
  expect(useWalletStore.getState().setMintNickname).not.toHaveBeenCalled();
  expect(mockSheetPresent).not.toHaveBeenCalled();
  await act(async () => iconButton('Save mint name').props.onPress());
  expect(useWalletStore.getState().setMintNickname).toHaveBeenCalledWith(url, 'Personal mint');
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children === 'Personal mint'),
  ).toBe(true);
});

it('keeps the name editable when persistence fails', async () => {
  useWalletStore.setState({
    setMintNickname: jest.fn(async () => {
      useWalletStore.setState({ error: 'Storage unavailable' });
    }),
  });
  await render();
  await act(async () => iconButton('Edit mint name').props.onPress());
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Draft'));
  await act(async () => iconButton('Save mint name').props.onPress());
  expect(tree.root.findByType('Input' as any).props.defaultValue).toBe('Draft');
  expect(mockToast.show).toHaveBeenCalledWith(
    'Could not save name',
    expect.objectContaining({ kind: 'error', duration: 4000 }),
  );
});

it('keeps mint removal on its confirmation screen until persistence succeeds', async () => {
  const remove = jest.fn().mockRejectedValue(new Error('storage unavailable'));
  useWalletStore.setState({ removeMint: remove });
  await render();
  const confirm = tree.root
    .findAllByType('AppButton' as any)
    .find((node) => node.props.children === 'Confirm Remove')!;
  await act(async () => confirm.props.onPress());
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockToast.show).toHaveBeenCalledTimes(1);
  expect(mockToast.show).toHaveBeenCalledWith(
    'Could not remove mint',
    expect.objectContaining({
      kind: 'error',
      duration: 4000,
      message: 'Check its balance and try again.',
    }),
  );
  remove.mockResolvedValue(undefined);
  await act(async () => confirm.props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockToast.show).toHaveBeenLastCalledWith(
    'Mint removed',
    expect.objectContaining({ kind: 'success', duration: 1000 }),
  );
});

it('allows clearing a nickname to restore the original mint name', async () => {
  await render();
  await act(async () => iconButton('Edit mint name').props.onPress());
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText(''));
  await act(async () => iconButton('Save mint name').props.onPress());
  expect(useWalletStore.getState().setMintNickname).toHaveBeenCalledWith(url, '');
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children === 'Original mint'),
  ).toBe(true);
});

it('opens inline editing from a mint selector without reopening it after save', async () => {
  mockEditName = 'true';
  await render();
  expect(tree.root.findByType('Input' as any).props.defaultValue).toBe('My mint');
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Picker nickname'));
  await act(async () => iconButton('Save mint name').props.onPress());
  await act(async () => {
    useWalletStore.setState({ balances: { [url]: 100 } });
  });
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  expect(useWalletStore.getState().setMintNickname).toHaveBeenCalledWith(url, 'Picker nickname');
});

it('keeps the balance and actions, shows mint information, and stops fetching transactions', async () => {
  await render();
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toEqual(
    expect.arrayContaining(['Deposit', 'Withdraw', 'Transfer', 'Trusted by you']),
  );
  expect(labels).not.toEqual(expect.arrayContaining(['Mint Transactions']));
  expect(labels).not.toEqual(expect.arrayContaining(['About Mint']));
  for (const label of ['Restore', 'Remove mint']) {
    expect(
      tree.root.findAllByType('ListTableRow' as any).find((node) => node.props.label === label)
        ?.props.onPress,
    ).toBeDefined();
  }
  expect(tree.root.findAllByType('MintPreviewHealth' as any)).toHaveLength(0);
  expect(iconButton('Share mint')).toBeDefined();
  expect(iconButton('Show mint QR code')).toBeDefined();
  expect(tree.root.findByType('MintOverview' as any).props).toMatchObject({
    url,
    connection: 'online',
  });
  const keys = jest.mocked(useQuery).mock.calls.map(([options]) => options.queryKey[0]);
  expect(keys).not.toContain('history');
  expect(keys).not.toContain('auditor-mint');
  const balance = tree.root
    .findAllByType('Text' as any)
    .find((node) => node.props.fontSize === 36)!;
  expect(balance.props.children).toContain('0');
  for (const [label, route] of [
    ['Deposit', '/(modals)/mint'],
    ['Withdraw', '/(modals)/melt'],
    ['Transfer', '/(modals)/swap'],
  ]) {
    const action = tree.root
      .findAllByType('Text' as any)
      .find((node) => node.props.children === label)!;
    await act(async () => action.parent!.props.onPress());
    expect(mockPush).toHaveBeenCalledWith(route);
  }
});

it('wires the connected mint connection row to a fresh metadata check', async () => {
  await render();
  await act(async () => tree.root.findByType('MintOverview' as any).props.onRecheck());
  expect(mockRecheckConnection).toHaveBeenCalledWith({ cancelRefetch: false });
  expect(jest.mocked(useQuery)).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: ['mint-metadata', url],
      networkMode: 'always',
    }),
  );
});
