import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking, Share } from 'react-native';
import { MintAboutRows } from '~/features/mints/components/MintAboutRows';
import { MintProfileScreen } from '~/features/mints';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { MintPreviewHealth } from '~/features/mints/components/MintPreviewHealth';
import {
  MintPreviewMethods,
  mintPreviewMethods,
} from '~/features/mints/components/MintPreviewMethods';
import { MintNutsRow } from '~/features/mints/components/MintNutsRow';
import { MintTermsRow } from '~/features/mints/components/MintTermsRow';

const url = 'https://mint.example/Bitcoin';
const mockRefetch = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSection = 'reliability';
const mockRouter = { canGoBack: () => true, back: jest.fn(), replace: mockReplace, push: mockPush };
let mockScore: number | null = 98;
let mockMetadataError: Error | null = null;
let mockCheckingConnection = false;
let mockProviderError = false;
let mockRadarRefreshError = false;
let mockRadarFetching = false;
let mockRadarUntracked = false;
let mockTestMint = false;
let mockRadarHealth = {
  scoreStale: false as boolean | null,
  status: 'online' as string | null,
  downSince: null as string | null,
  scoreCappedNew: false,
};
let mockUptime24 = 100;
let mockDaily = [
  { day: '2026-10-18', uptime: 100, checks: 288 },
  { day: '2026-10-19', uptime: 90, checks: 288 },
  { day: '2026-10-20', uptime: 100, checks: 100 },
];
let mockCountry = 'US';
let mockTests = { total: 15, success: 14, failed: 1, avgMs: 6400 };
const mockInfo = {
  name: 'Example mint',
  description: 'Community mint',
  version: 'cdk/0.17',
  tos_url: 'https://mint.example/terms?version=1',
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
          : mockRadarUntracked
            ? null
            : {
                url,
                score: mockScore,
                uptime7dPct: 99,
                lastCheckedAt: '2026-10-20T05:25:00Z',
                ...mockRadarHealth,
              },
        isError: mockProviderError || mockRadarRefreshError,
        isFetching: mockRadarFetching,
      };
    if (key[1] === 'cashu-info-list')
      return {
        ...base,
        data: mockProviderError
          ? undefined
          : [{ id: 'mint1', url, uptime24h: mockUptime24, uptime7d: 99, isTest: mockTestMint }],
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
              uptime: { '24h': mockUptime24, '7d': 99 },
              daily: mockDaily,
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
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ mintUrl: url, section: mockSection }),
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
      'X',
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
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
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
  mockSection = 'reliability';
  mockMetadataError = null;
  mockCheckingConnection = false;
  mockProviderError = false;
  mockRadarRefreshError = false;
  mockRadarFetching = false;
  mockRadarUntracked = false;
  mockTestMint = false;
  mockRadarHealth = { scoreStale: false, status: 'online', downSince: null, scoreCappedNew: false };
  mockUptime24 = 100;
  mockDaily = [
    { day: '2026-10-18', uptime: 100, checks: 288 },
    { day: '2026-10-19', uptime: 90, checks: 288 },
    { day: '2026-10-20', uptime: 100, checks: 100 },
  ];
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
  useSettingsStore.setState({
    hideMintConnectionDisclaimer: false,
    setHideMintConnectionDisclaimer: jest.fn(async (hide) => {
      useSettingsStore.setState({ hideMintConnectionDisclaimer: hide });
    }),
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});
const content = (section: string) =>
  section === 'preview' ? (
    <MintProfileScreen url={url} />
  ) : section === 'reliability' ? (
    <MintPreviewHealth
      url={url}
      connection={mockCheckingConnection ? 'checking' : mockMetadataError ? 'offline' : 'online'}
      connectionCheckedAt={1000}
      onRecheck={() => {
        mockRefetch({ cancelRefetch: false });
      }}
    />
  ) : section === 'payments' ? (
    <MintPreviewMethods info={mockInfo} />
  ) : (
    <MintAboutRows url={url} info={mockInfo} />
  );
const render = async (section = 'reliability') => {
  mockSection = section;
  await act(async () => {
    tree = create(content(section));
  });
};

it('keeps preview focused and expands full-width information without navigation or nested lists', async () => {
  await render('preview');
  expect(row('Connection').props.value).toBe('Reachable');
  expect(row('Deposit').props.value).toBe('Lightning');
  expect(row('Withdraw').props.value).toBe('Lightning');
  expect(row('Reliability').props.value).toBe('99% uptime · 7d');
  for (const label of [
    'Version',
    'Public key',
    'Minimum',
    'Uptime · 24 hours',
    'Reliability score',
  ]) {
    expect(row(label)).toBeUndefined();
  }
  await act(async () => row('Payments & limits').props.onPress());
  expect(row('Minimum')).toBeDefined();
  expect(tree.root.findAllByType('ListTable' as any)).toHaveLength(3);
  expect(
    tree.root.findAllByType('ListTableRow' as any).filter((node) => node.props.label === 'Deposit'),
  ).toHaveLength(1);
  expect(row('Payments & limits').props.expanded).toBe(true);
  await act(async () => row('Reliability').props.onPress());
  expect(row('Minimum')).toBeUndefined();
  expect(row('Uptime · 24 hours')).toBeDefined();
  expect(tree.root.findAllByType('ListTable' as any)).toHaveLength(3);
  expect(
    tree.root
      .findAllByType('ListTableRow' as any)
      .filter((node) => node.props.label === 'Connection'),
  ).toHaveLength(1);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => row('About this mint').props.onPress());
  expect(row('About this mint').props.expanded).toBe(true);
  expect(row('URL').props.copyValue).toBe(url);
  expect(row('Version').props.value).toBe('cdk/0.17');
  expect(tree.root.findAllByType('ListTable' as any)).toHaveLength(3);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => row('About this mint').props.onPress());
  expect(row('Version')).toBeUndefined();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
});

it('keeps the test-mint warning visible before adding even when only cashu.info identifies it', async () => {
  mockTestMint = true;
  await render('preview');
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Test mint · Not real bitcoin',
  );
});

it('keeps payment limits expandable inline and technical details directly inside About', async () => {
  await render('payments');
  expect(
    tree.root
      .findAllByType('ListTableRow' as any)
      .filter((node) => node.props.label === 'Maximum')
      .map((node) => node.props.value),
  ).toEqual(['1,000 sat', '2,000 sat']);
  mockSection = 'about';
  await act(async () => {
    tree.update(content(mockSection));
  });
  expect(row('Version').props.value).toBe('cdk/0.17');
  expect(row('URL').props.copyValue).toBe(url);
  expect(row('Advertised NUTs')).toBeDefined();
  expect(mockPush).not.toHaveBeenCalled();
});

it('shows independent uptime and payment results, MintRadar score, and actual advertised units', async () => {
  await render();
  expect(row('Connection').props).toMatchObject({ value: 'Online', valueColor: '$green11' });
  expect(score()?.props.value).toBe('98%');
  expect(row('Server country').props.value).toBe('United States');
  expect(row('Uptime · 24 hours').props.value).toBe('100%');
  const bars = tree.root.findAllByProps({ accessibilityRole: 'image' });
  expect(bars).toHaveLength(3);
  expect(bars.slice(-3).map((bar) => bar.props.bg)).toEqual(['$green11', '$red9', '$green11']);
  expect(bars.at(-2)?.props.accessibilityLabel).toBe('2026-10-19: 90% uptime');
  expect(row('Payment success · 7 days').props.value).toBe('93.3% (14/15)');
  expect(row('Failures attributed to mint').props.value).toBe('0');
  expect(row('Mint balance / reserves').props.value).toBe('Not published');
  mockSection = 'technical';
  await act(async () => {
    tree.update(content(mockSection));
  });
  expect(row('Units').props.value).toBe('sat');
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
});

it.each(['offline', 'degraded', 'archived'])(
  'labels a %s mint score as historical while keeping device connection independent',
  async (status) => {
    const downSince = '2026-10-20T04:00:00Z';
    mockRadarHealth = { ...mockRadarHealth, status, scoreStale: true, downSince };
    await render();
    expect(row('Last measured score').props).toMatchObject({ value: '98%', valueColor: '$gray10' });
    expect(row('MintRadar offline since').props.value).toBe(new Date(downSince).toLocaleString());
    expect(row('Connection').props.value).toBe('Online');
    expect(score()).toBeUndefined();
  },
);

it('restores the current score presentation and removes outage timing after recovery', async () => {
  mockRadarHealth = {
    ...mockRadarHealth,
    status: 'offline',
    scoreStale: true,
    downSince: '2026-10-20T04:00:00Z',
  };
  await render();
  mockRadarHealth = { ...mockRadarHealth, status: 'online', scoreStale: false, downSince: null };
  await act(async () => {
    tree.update(content(mockSection));
  });
  expect(score().props).toMatchObject({ value: '98%', valueColor: '$green11' });
  expect(row('MintRadar offline since')).toBeUndefined();
  expect(row('Last measured score')).toBeUndefined();
});

it('keeps unknown freshness and a historical zero score neutral without inventing outage timing', async () => {
  mockScore = 0;
  mockRadarHealth = { ...mockRadarHealth, status: null, scoreStale: null };
  await render();
  expect(row('Last measured score').props).toMatchObject({ value: '0%', valueColor: '$gray10' });
  expect(row('MintRadar offline since')).toBeUndefined();
});

it('shows saved scores as historical after a failed refresh without marking the mint offline', async () => {
  mockRadarRefreshError = true;
  await render();
  expect(row('Last measured score').props).toMatchObject({ value: '98%', valueColor: '$gray10' });
  expect(row('Connection').props.value).toBe('Online');
  expect(row('MintRadar offline since')).toBeUndefined();
});

it('does not infer an outage from a stale score alone or an inconsistent online outage timestamp', async () => {
  mockRadarHealth = { ...mockRadarHealth, scoreStale: true, downSince: '2026-10-20T04:00:00Z' };
  await render();
  expect(row('Last measured score').props.value).toBe('98%');
  expect(row('MintRadar offline since')).toBeUndefined();
});

it.each([
  ['checking', true, false, 'Checking…'],
  ['untracked', false, true, 'Not rated'],
  ['unscored', false, false, 'Unavailable'],
] as const)('preserves the %s score state', async (_state, fetching, untracked, value) => {
  mockScore = null;
  mockRadarFetching = fetching;
  mockRadarUntracked = untracked;
  await render();
  expect(score().props.value).toBe(value);
  expect(row('Last measured score')).toBeUndefined();
});

it('retains the new-mint cap explanation with historical scores', async () => {
  mockRadarHealth = { ...mockRadarHealth, scoreStale: true, scoreCappedNew: true };
  await render();
  expect(row('Last measured score').props.valueColor).toBe('$gray10');
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((node) => node.props.children === 'New mint · Score capped'),
  ).toBe(true);
});

it('expands only the advertised NUTs with numbers, names, and checks, then collapses', async () => {
  await render('technical');
  const toggle = () => tree.root.findByProps({ accessibilityLabel: 'Advertised NUTs' });
  const entries = () =>
    tree.root
      .findAllByType('ListTableRow' as any)
      .filter((node) => node.props.label.startsWith('NUT-'));
  expect(row('Advertised NUTs').props.value).toBe(3);
  expect(entries()).toHaveLength(0);
  await act(async () => toggle().props.onPress());
  expect(toggle().props.accessibilityState.expanded).toBe(true);
  expect(entries().map((node) => node.props.label)).toEqual([
    'NUT-04 · Minting tokens',
    'NUT-05 · Melting tokens',
    'NUT-14 · HTLC locking',
  ]);
  expect(entries().every((node) => node.props.rightContent.type === 'Check')).toBe(true);
  await act(async () => toggle().props.onPress());
  expect(toggle().props.accessibilityState.expanded).toBe(false);
  expect(entries()).toHaveLength(0);
});

it('does not tick explicitly unsupported, disabled, or malformed NUT entries', async () => {
  await act(async () => {
    tree = create(
      <MintNutsRow
        nuts={{
          '14': { supported: true },
          '4': { methods: [{ method: 'bolt11', unit: 'sat' }] },
          '5': { disabled: true },
          '11': { supported: false },
          '17': { supported: [] },
          '7': null,
          '9': false,
          '44': { supported: true },
          unknown: {},
        }}
      />,
    );
  });
  expect(row('Advertised NUTs').props.value).toBe(3);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Advertised NUTs' }).props.onPress(),
  );
  expect(
    tree.root
      .findAllByType('ListTableRow' as any)
      .filter((node) => node.props.label.startsWith('NUT-'))
      .map((node) => node.props.label),
  ).toEqual(['NUT-04 · Minting tokens', 'NUT-14 · HTLC locking', 'NUT-44 · Additional capability']);
});

it('opens the colored terms link in the browser with an external-link icon', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await render('about');
  const terms = row('Terms of service');
  expect(terms.props.valueColor).toBe('$accentColor');
  expect(terms.props.rightContent.type).toBe('ExternalLink');
  expect(terms.props.isCopyable).toBeUndefined();
  await act(async () => terms.props.onPress());
  expect(open).toHaveBeenCalledWith(mockInfo.tos_url);
});

it('omits terms links that are not valid public web URLs', async () => {
  await act(async () => {
    tree = create(<MintTermsRow url={undefined} />);
  });
  for (const link of [
    'javascript:alert(1)',
    'file:///private/terms',
    'https://user:pass@mint.example/terms',
    'invalid',
  ]) {
    await act(async () => tree.update(<MintTermsRow url={link} />));
    expect(tree.root.findAllByType('ListTableRow' as any)).toHaveLength(0);
  }
});

it('trims days outside recorded history while retaining gaps and zero-uptime days', async () => {
  mockDaily = [
    { day: '2026-10-16', uptime: 100, checks: 0 },
    { day: '2026-10-18', uptime: 100, checks: 288 },
    { day: '2026-10-20', uptime: 0, checks: 288 },
    { day: '2026-10-21', uptime: 100, checks: 0 },
  ];
  await render();
  const bars = tree.root.findAllByProps({ accessibilityRole: 'image' });
  expect(bars.map((bar) => bar.props.accessibilityLabel)).toEqual([
    '2026-10-18: 100% uptime',
    '2026-10-19: No data',
    '2026-10-20: 0% uptime',
  ]);
  expect(bars.map((bar) => bar.props.bg)).toEqual(['$green11', '$gray5', '$red9']);
});

it('shares the exact URL and opens and dismisses the QR overlay without connecting', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render('preview');
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
  await render('preview');
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
  expect(row('Connection').props).toMatchObject({ value: 'Unreachable', valueColor: '$gray10' });
  expect(recheck()).toMatchObject({ loading: false, disabled: false });
});

it('shows mint identity and disclaimer, then connects only after confirmation', async () => {
  await render('preview');
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
  await render('preview');
  await act(async () => button('Connect').props.onPress());
  await act(async () => button('Confirm').props.onPress());
  expect(tree.root.findByType('AppBottomSheet' as any)).toBeDefined();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Mint validation failed',
  );
  expect(button('Confirm').props.disabled).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(useSettingsStore.getState().setHideMintConnectionDisclaimer).not.toHaveBeenCalled();
});

it('shows bullet points and remembers the checkbox only after a successful connection', async () => {
  await render('preview');
  await act(async () => button('Connect').props.onPress());
  expect(
    tree.root.findAllByType('Text' as any).filter((node) => node.props.children === '•'),
  ).toHaveLength(3);
  const checkbox = () => tree.root.findByProps({ accessibilityRole: 'checkbox' });
  expect(checkbox().props.accessibilityState.checked).toBe(false);
  await act(async () => checkbox().props.onPress());
  expect(checkbox().props.accessibilityState.checked).toBe(true);
  expect(useSettingsStore.getState().setHideMintConnectionDisclaimer).not.toHaveBeenCalled();
  expect(useWalletStore.getState().addMint).not.toHaveBeenCalled();
  await act(async () => button('Confirm').props.onPress());
  expect(useSettingsStore.getState().setHideMintConnectionDisclaimer).toHaveBeenCalledWith(true);
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith(url, { trusted: true });
});

it('connects directly with only button loading when consent is remembered, without opening a sheet', async () => {
  useSettingsStore.setState({ hideMintConnectionDisclaimer: true });
  let finish!: () => void;
  useWalletStore.setState({
    addMint: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
            resolve();
          };
        }),
    ),
  });
  await render('preview');
  const connect = button('Connect').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = connect();
    void connect();
  });
  expect(useWalletStore.getState().addMint).toHaveBeenCalledTimes(1);
  expect(useWalletStore.getState().addMint).toHaveBeenCalledWith(url, { trusted: true });
  expect(tree.root.findAllByType('AppBottomSheet' as any)).toHaveLength(0);
  expect(button('Connect').props).toMatchObject({ loading: true, disabled: true });
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await pending;
  });
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl: url },
  });
  expect(useSettingsStore.getState().hideMintConnectionDisclaimer).toBe(true);
});

it('shows direct-connection errors on preview and allows retry without opening a sheet', async () => {
  useSettingsStore.setState({ hideMintConnectionDisclaimer: true });
  useWalletStore.setState({
    addMint: jest.fn(async () => {
      useWalletStore.setState({ error: 'Mint validation failed' });
    }),
  });
  await render('preview');
  await act(async () => button('Connect').props.onPress());
  expect(tree.root.findAllByType('AppBottomSheet' as any)).toHaveLength(0);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Mint validation failed',
  );
  expect(button('Connect').props).toMatchObject({ loading: false, disabled: false });
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => {
    useWalletStore.setState({
      addMint: jest.fn(async () => {
        useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] });
      }),
    });
  });
  await act(async () => button('Connect').props.onPress());
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(modals)/mint-details',
    params: { mintUrl: url },
  });
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
  await render('preview');
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
  const bars = tree.root.findAllByProps({ accessibilityRole: 'image' });
  expect(bars).toHaveLength(0);
  expect(row('Payment success · 7 days').props.value).toBe('Unavailable');
});

it('retains real zero scores and distinguishes no samples from zero success', async () => {
  mockScore = 0;
  mockUptime24 = 0;
  mockDaily = [{ day: '2026-10-20', uptime: 0, checks: 100 }];
  mockTests = { total: 0, success: 0, failed: 0, avgMs: 0 };
  await render();
  expect(score()?.props.value).toBe('0%');
  expect(score()?.props.valueColor).toBe('$red11');
  expect(row('Uptime · 24 hours').props.value).toBe('0%');
  expect(tree.root.findByProps({ accessibilityLabel: '2026-10-20: 0% uptime' }).props.bg).toBe(
    '$red9',
  );
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
  await render('preview');
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
