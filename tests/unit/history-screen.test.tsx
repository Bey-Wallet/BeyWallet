import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HistoryScreen } from '~/features/history';
import { checkHistoryStatus } from '~/features/history/checkHistoryStatus';

const mockPush = jest.fn();
const mockInvalidate = jest.fn();
const mockPresent = jest.fn();
const mockLoadRequests = jest.fn(async () => {});
const mockMints: unknown[] = [];
const mockRequests: unknown[] = [];
const mockHistory = [
  {
    id: 'send',
    type: 'send',
    amount: 10,
    unit: 'sat',
    mintUrl: 'https://mint.example',
    state: 'pending',
    createdAt: Date.now(),
  },
  {
    id: 'receive',
    type: 'receive',
    amount: 20,
    unit: 'sat',
    mintUrl: 'https://mint.example',
    createdAt: Date.now(),
  },
];
const mockClient = { invalidateQueries: mockInvalidate };
const mockRouter = { push: mockPush };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('tamagui', () => ({
  ...Object.fromEntries(['YStack', 'XStack', 'Text'].map((name) => [name, name])),
  useTheme: () => ({ color: { val: '#ffffff' } }),
}));
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'ArrowDownLeft',
      'ArrowUpRight',
      'ArrowRightLeft',
      'ReceiptText',
      'RefreshCw',
      'Zap',
      'Bitcoin',
      'Clock',
      'Inbox',
      'RotateCcw',
      'Check',
    ].map((name) => [name, name]),
  ),
);
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === 'history' ? mockHistory : undefined,
    refetch: jest.fn(),
  }),
  useQueryClient: () => mockClient,
}));
jest.mock('@legendapp/list/react-native', () => ({
  LegendList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
    <>
      {ListHeaderComponent}
      {data.length
        ? data.map((item: any, index: number) =>
            require('react').createElement(
              require('react').Fragment,
              { key: index },
              renderItem({ item }),
            ),
          )
        : ListEmptyComponent}
    </>
  ),
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'BottomSheetScrollView' }));
jest.mock('~/services/wallet', () => ({
  initService: { isInitialized: () => true },
  historyService: {},
  eventService: { on: () => () => {} },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) => selector({ mints: mockMints }),
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: (selector: any) =>
    selector({ pendingRequests: mockRequests, loadPendingRequests: mockLoadRequests }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({ primaryCurrency: 'SATS', secondaryCurrency: 'NONE' }),
}));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (value: number) => `${value} sats` },
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/features/history/checkHistoryStatus', () => ({ checkHistoryStatus: jest.fn() }));
jest.mock('~/features/history/components/HistorySkeletonItem', () => ({
  HistoryPageSkeleton: 'HistoryPageSkeleton',
}));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ children }: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: jest.fn() }));
    return children;
  }),
}));

let screen: ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    screen = create(<HistoryScreen />);
  });
});
afterEach(() => {
  act(() => screen.unmount());
});
const pressable = (label: string) =>
  screen.root.findAll(
    (node) => node.type === ('AppPressable' as any) && node.props.accessibilityLabel === label,
  )[0];
const transactionButtons = () =>
  screen.root.findAll(
    (node) =>
      node.type === ('AppPressable' as any) &&
      node.props.accessibilityLabel?.includes('Open details'),
  );

it('renders real rows, opens details and toggles quick filters back to all activity', () => {
  expect(transactionButtons()).toHaveLength(2);
  act(() => transactionButtons()[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/txn-details',
    params: { id: 'send' },
  });
  act(() => pressable('Received').props.onPress());
  expect(transactionButtons()).toHaveLength(1);
  expect(transactionButtons()[0].props.accessibilityLabel).toContain('Received');
  act(() => pressable('Received').props.onPress());
  expect(transactionButtons()).toHaveLength(2);
  act(() => pressable('Pending').props.onPress());
  expect(transactionButtons()).toHaveLength(1);
  expect(transactionButtons()[0].props.accessibilityLabel).toContain('Pending');
});

it('checks once per tap sequence, spins and keeps the status button separate from navigation', async () => {
  let finish!: (value: string) => void;
  jest.mocked(checkHistoryStatus).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const button = pressable('Check status of sent ecash');
  act(() => {
    button.props.onPress();
    button.props.onPress();
  });
  expect(checkHistoryStatus).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.root.findAllByType('Spinner' as any)).toHaveLength(1);
  await act(async () => {
    finish('Still pending');
  });
  expect(screen.root.findAllByType('Spinner' as any)).toHaveLength(0);
});

it('opens advanced filters when requested by the route header', async () => {
  await act(async () => {
    screen.update(<HistoryScreen showFilters />);
  });
  expect(mockPresent).toHaveBeenCalledTimes(1);
});

it('keeps quick filters usable when no activity matches', () => {
  act(() => pressable('Bitcoin').props.onPress());
  expect(transactionButtons()).toHaveLength(0);
  expect(pressable('Pending')).toBeDefined();
  expect(pressable('Sent')).toBeDefined();
  expect(pressable('Received')).toBeDefined();
});
