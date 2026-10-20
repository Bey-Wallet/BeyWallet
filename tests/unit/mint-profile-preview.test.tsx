import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Share } from 'react-native';
import { MintProfileScreen } from '~/features/mints';
import { useWalletStore } from '~/state/walletStore';
import { mintPreviewMethods } from '~/features/mints/components/MintPreviewMethods';

const url = 'https://mint.example/Bitcoin';
const mockRefetch = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { canGoBack: () => true, back: jest.fn(), replace: mockReplace };
let mockScore: number | null = 98;
let mockMetadataError: Error | null = null;
let mockCheckingConnection = false;
let mockProviderError = false;
let mockCountry = 'US';
let mockTests = { total: 15, success: 14, failed: 1, avgMs: 6400 };
const mockInfo = {
  name: 'Example mint',
  description: 'Community mint',
  version: 'cdk/0.17',
  nuts: {
    '4': { methods: [{ method: 'bolt11', unit: 'sat', min_amount: 0, max_amount: 1000 }] },
    '5': { methods: [{ method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 2000 }] },
    '14': { supported: true },
  },
};
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => {
    const key = options.queryKey;
    const base = {
      isFetching: false,
      isLoading: false,
      error: null,
      isError: false,
      errorUpdatedAt: 0,
      dataUpdatedAt: 1000,
      refetch: mockRefetch,
    };
    if (key[0] === 'mint-metadata')
      return {
        ...base,
        data: mockInfo,
        isFetching: mockCheckingConnection,
        error: mockMetadataError,
        errorUpdatedAt: mockMetadataError ? 2000 : 0,
      };
    if (key[1] === 'radar')
      return {
        ...base,
        data: mockProviderError
          ? undefined
          : { url, score: mockScore, lastCheckedAt: '2026-10-20T05:25:00Z' },
        isError: mockProviderError,
      };
    if (key[1] === 'cashu-info-list')
      return {
        ...base,
        data: mockProviderError ? undefined : [{ id: 'mint1', url, uptime24h: 100, uptime7d: 99 }],
        isError: mockProviderError,
      };
    if (key[1] === 'cashu-info-detail')
      return {
        ...base,
        data: mockProviderError
          ? undefined
          : {
              id: 'mint1',
              url,
              network: { country: mockCountry },
              uptime: { '24h': 100, '7d': 99 },
              swaps7d: { all: mockTests, errorsBlamed: 0 },
            },
        isError: mockProviderError,
      };
    return { ...base, data: undefined };
  },
}));
jest.mock('~/services/api/mintHealthService', () => ({
  ...jest.requireActual('~/services/api/mintHealthService'),
  mintHealthService: {
    cachedRadar: () => undefined,
    cachedCashuList: () => undefined,
    cachedCashuDetail: () => undefined,
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));
jest.mock('~/services/api/mintRecommendationService', () => ({ mintRecommendationService: {} }));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Stack: { Screen: 'Screen' },
}));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'BottomSheetScrollView' }));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['YStack', 'XStack', 'Text', 'H2', 'H3', 'H4', 'Separator', 'ScrollView', 'View', 'Card'].map(
      (name) => [name, name],
    ),
  ),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'Link',
      'Mail',
      'Globe',
      'Info',
      'Copy',
      'Check',
      'ChevronLeft',
      'Sprout',
      'Share2',
      'MessageSquare',
      'ShieldCheck',
      'Cpu',
      'Plus',
      'ShieldOff',
      'QrCode',
      'ChevronDown',
      'ChevronUp',
      'ExternalLink',
      'RefreshCw',
    ].map((name) => [name, name]),
  ),
);
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children, canDismiss }: any, ref: any) => {
      const [visible, setVisible] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        dismiss: () => {
          if (canDismiss) setVisible(false);
        },
      }));
      return visible ? React.createElement('AppBottomSheet', { canDismiss }, children) : null;
    }),
  };
});
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: ({ children, ...props }: any) =>
    require('react').createElement('ListTable', props, children),
  ListTableRow: 'ListTableRow',
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ visible, children, ...props }: any) =>
    visible ? require('react').createElement('Modal', props, children) : null,
}));

let tree: ReactTestRenderer;
const row = (label: string) =>
  tree.root.findAllByType('ListTableRow' as any).find((node) => node.props.label === label)!;
const button = (label: string) =>
  tree.root.findAllByType('AppButton' as any).find((node) => node.props.children === label)!;
const score = () => row('Reliability score');
beforeEach(() => {
  jest.clearAllMocks();
  mockScore = 98;
  mockMetadataError = null;
  mockCheckingConnection = false;
  mockProviderError = false;
  mockCountry = 'US';
  mockTests = { total: 15, success: 14, failed: 1, avgMs: 6400 };
  useWalletStore.setState({
    mints: [],
    error: null,
    addMint: jest.fn(async () => {
      useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true } as any] });
    }),
    removeMint: jest.fn(),
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});
const render = async () => {
  await act(async () => {
    tree = create(<MintProfileScreen url={url} />);
  });
};

it('shows independent uptime and payment results, MintRadar score, and actual advertised units', async () => {
  await render();
  expect(row('Connection').props).toMatchObject({ value: 'Online', valueColor: '$green11' });
  expect(score()?.props.value).toBe('98%');
  expect(row('Server country').props.value).toBe('United States');
  expect(row('Uptime · 24 hours').props.value).toBe('100%');
  expect(row('Payment success · 7 days').props.value).toBe('93.3% (14/15)');
  expect(row('Failures attributed to mint').props.value).toBe('0');
  expect(row('Mint balance / reserves').props.value).toBe('Not published');
  expect(row('Units').props.value).toBe('sat');
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
});

it('shares the exact URL and opens and dismisses the QR overlay without connecting', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render();
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Share mint' }).props.onPress(),
  );
  expect(share).toHaveBeenCalledWith({ message: url });
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Show mint QR code' }).props.onPress(),
  );
  expect(tree.root.findByType('QRCode' as any).props.value).toBe(url);
  await act(async () => tree.root.findByType('Modal' as any).props.onRequestClose());
  expect(tree.root.findAllByType('QRCode' as any)).toHaveLength(0);
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  await act(async () => button('Connect').props.onPress());
  expect(button('Confirm')).toBeDefined();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
});

it('shows full country names without Intl.DisplayNames on Android', async () => {
  mockCountry = 'SG';
  const displayNames = Intl.DisplayNames;
  Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: undefined });
  try {
    await render();
    expect(row('Server country').props.value).toBe('Singapore');
  } finally {
    Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: displayNames });
  }
});

it('rechecks the connection on request and shows loading before the live result', async () => {
  await render();
  const recheck = () => row('Connection').props.rightContent.props;
  expect(recheck()).toMatchObject({
    accessibilityLabel: 'Recheck mint connection',
    loading: false,
  });
  await act(async () => recheck().onPress());
  expect(mockRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
  mockCheckingConnection = true;
  await act(async () => tree.update(<MintProfileScreen url={url} />));
  expect(recheck()).toMatchObject({ loading: true, disabled: true });
  expect(row('Connection').props.value).toBe('Checking…');
  mockCheckingConnection = false;
  mockMetadataError = new Error('Mint unreachable');
  await act(async () => tree.update(<MintProfileScreen url={url} />));
  expect(row('Connection').props).toMatchObject({ value: 'Offline', valueColor: '$red11' });
  expect(recheck()).toMatchObject({ loading: false, disabled: false });
});

it('shows mint identity and disclaimer, then connects only after confirmation', async () => {
  await render();
  await act(async () => button('Connect').props.onPress());
  const sheet = tree.root.findByType('AppBottomSheet' as any);
  const copy = sheet
    .findAllByType('Text' as any)
    .map((node) => node.props.children)
    .flat()
    .join(' ');
  expect(copy).toContain('Bey Wallet does not operate this mint');
  expect(sheet.findByType('MintImage' as any).props.mintUrl).toBe(url);
  expect(sheet.findAllByType('Text' as any).map((node) => node.props.children)).toEqual(
    expect.arrayContaining(['Example mint', url]),
  );
  await act(async () => button('Confirm').props.onPress());
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith(url, { trusted: true });
  expect(tree.root.findAllByType('AppBottomSheet' as any)).toHaveLength(0);
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl: url },
  });
});

it('keeps the confirmation open when the wallet reports an add error', async () => {
  useWalletStore.setState({
    addMint: jest.fn(async () => {
      useWalletStore.setState({ error: 'Mint validation failed' });
    }),
  });
  await render();
  await act(async () => button('Connect').props.onPress());
  await act(async () => button('Confirm').props.onPress());
  expect(tree.root.findByType('AppBottomSheet' as any)).toBeDefined();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Mint validation failed',
  );
  expect(button('Confirm').props.disabled).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('blocks duplicate confirmation and dismissal while connecting', async () => {
  let finish!: () => void;
  useWalletStore.setState({
    addMint: jest.fn(() => {
      useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    }),
  });
  await render();
  await act(async () => button('Connect').props.onPress());
  const confirm = button('Confirm').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = confirm();
    void confirm();
  });
  expect(useWalletStore.getState().addMint).toHaveBeenCalledTimes(1);
  expect(button('Confirm').props).toMatchObject({
    disabled: true,
    loading: true,
    loadingText: 'Connecting to mint…',
  });
  expect(tree.root.findByType('AppBottomSheet' as any).props.canDismiss).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await pending;
  });
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl: url },
  });
});

it('does not turn missing monitoring into a failed mint or fabricate zero success', async () => {
  mockProviderError = true;
  await render();
  expect(row('Connection').props.value).toBe('Online');
  expect(score()?.props.value).toBe('Unavailable');
  expect(row('Server country').props.value).toBe('Unknown');
  expect(row('Payment success · 7 days').props.value).toBe('Unavailable');
});

it('retains real zero scores and distinguishes no samples from zero success', async () => {
  mockScore = 0;
  mockTests = { total: 0, success: 0, failed: 0, avgMs: 0 };
  await render();
  expect(score()?.props.value).toBe('0%');
  expect(score()?.props.valueColor).toBe('$red11');
  expect(row('Payment success · 7 days').props.value).toBe('No recent tests');
});

it.each([
  [74.9, '$red11'],
  [75, '$color'],
  [75.1, '$green11'],
  [90, '$green11'],
  [90.1, '$green11'],
  [null, '$color'],
])('colors reliability score %s with %s', async (value, color) => {
  mockScore = value as number | null;
  await render();
  expect(score()?.props.valueColor).toBe(color);
});

it('keeps cached metadata visible when the direct connection fails', async () => {
  mockMetadataError = new Error('Offline');
  await render();
  expect(row('Connection').props).toMatchObject({ value: 'Offline', valueColor: '$red11' });
  expect(score()?.props.value).toBe('98%');
});

it('opens the updated details screen when the profile URL is already connected', async () => {
  useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
  await render();
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl: url },
  });
  expect(row('Success Rate')).toBeUndefined();
});

it('keeps limits separate by method, direction, and unit, preserving zero limits', () => {
  const rows = mintPreviewMethods({
    nuts: {
      '4': {
        methods: [
          { method: 'bolt11', unit: 'sat', min_amount: 0, max_amount: 1000 },
          { method: 'bolt11', unit: 'usd', min_amount: 1, max_amount: 10 },
        ],
      },
      '5': {
        methods: [
          { method: 'onchain', unit: 'sat', min_amount: 50, options: { confirmations: 0 } },
        ],
      },
    },
  });
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ minimum: '0 sat', maximum: '1,000 sat' });
  expect(rows[1]).toMatchObject({ minimum: '1 usd', maximum: '10 usd' });
  expect(rows[2]).toMatchObject({ direction: 'Send', confirmations: 0 });
});
