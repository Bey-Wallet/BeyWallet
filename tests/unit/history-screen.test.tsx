import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HistoryScreen } from '~/features/history';
import { HistoryItem } from '~/features/history/components/HistoryItem';
import { checkHistoryStatus } from '~/features/history/checkHistoryStatus';
import { useQuery } from '@tanstack/react-query';
import { historyService } from '~/services/wallet';

const mockPush = jest.fn();
const mockInvalidate = jest.fn();
const mockPresent = jest.fn();
const mockLoadRequests = jest.fn(async () => {});
const mockMints: unknown[] = [];
const mockRequests: unknown[] = [];
const mockPayments: { operationId: string; published: boolean }[] = [];
let mockSearchLoading = false;
let mockSearchError = false;
const mockRefetchSearch = jest.fn();
const mockPeople = {
  alice: { npub: 'public-test-identity', displayName: 'Alice', username: 'alice' },
};
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
const mockOlderHistory = {
  id: 'older-coffee',
  type: 'send',
  amount: 1000,
  unit: 'sat',
  mintUrl: 'https://mint.example',
  createdAt: new Date(2025, 2, 12).getTime(),
  metadata: { note: 'Coffee', nostrPubkey: 'public-test-identity' },
};
const mockClient = { invalidateQueries: mockInvalidate };
const mockRouter = { push: mockPush };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('tamagui', () => ({
  ...Object.fromEntries(['YStack', 'XStack', 'Text'].map((name) => [name, name])),
  useTheme: () => ({ color: { val: '#ffffff' }, orange10: { val: '#F5A73B' } }),
}));
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'ArrowDownLeft',
      'ArrowUpRight',
      'ArrowDownToLine',
      'ArrowUpFromLine',
      'ArrowRightLeft',
      'ReceiptText',
      'RefreshCw',
      'Zap',
      'Bitcoin',
      'Clock',
      'Inbox',
      'RotateCcw',
      'Check',
      'Search',
      'X',
    ].map((name) => [name, name]),
  ),
);
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: any) => ({
    data:
      queryKey[1] === 'search'
        ? mockSearchLoading || mockSearchError
          ? undefined
          : [...mockHistory, mockOlderHistory]
        : queryKey[0] === 'history'
          ? mockHistory
          : undefined,
    isLoading: queryKey[1] === 'search' && mockSearchLoading,
    isError: queryKey[1] === 'search' && mockSearchError,
    refetch: queryKey[1] === 'search' ? mockRefetchSearch : jest.fn(),
  })),
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
  historyService: { getActivityHistory: jest.fn(async () => []) },
  eventService: { on: () => () => {} },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) => selector({ mints: mockMints }),
}));
jest.mock('~/state/peopleStore', () => ({
  usePeopleStore: (selector: any) => selector({ people: mockPeople }),
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: (selector: any) =>
    selector({
      pendingRequests: mockRequests,
      payments: mockPayments,
      loadPendingRequests: mockLoadRequests,
    }),
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
jest.mock('~/shared/ui/AppInput', () => ({ AppInput: 'Input' }));
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
  mockPayments.length = 0;
  mockSearchLoading = false;
  mockSearchError = false;
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
  expect(
    screen.root.findAllByType('Text' as any).some((node) => node.props.children === 'just now'),
  ).toBe(true);
  expect(transactionButtons()).toHaveLength(2);
  act(() => transactionButtons()[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/txn-details',
    params: { id: 'send' },
  });
  act(() => pressable('Received').props.onPress());
  expect(transactionButtons()).toHaveLength(1);
  expect(transactionButtons()[0].props.accessibilityLabel).toContain('Received');
  act(() => pressable('Received').props.onPress());
  expect(transactionButtons()).toHaveLength(2);
  act(() => pressable('Pending').props.onPress());
  expect(transactionButtons()).toHaveLength(1);
  expect(transactionButtons()[0].props.accessibilityLabel).toContain('Created');
});

it('checks once per tap sequence, spins and keeps the status button separate from navigation', async () => {
  let finish!: (value: string) => void;
  jest.mocked(checkHistoryStatus).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const button = pressable('Check status of created ecash');
  const title = screen.root
    .findAllByType('Text' as any)
    .find((text) => text.props.children === 'Ecash created')!;
  expect(button.parent).toBe(title.parent);
  const event = { stopPropagation: jest.fn() };
  act(() => {
    button.props.onPress(event);
    button.props.onPress(event);
  });
  expect(event.stopPropagation).toHaveBeenCalledTimes(2);
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

it('shows delivery only for the matching published operation and keeps claim separate', async () => {
  let item!: ReactTestRenderer;
  const entry = { ...mockHistory[0], operationId: 'expected-operation' };
  const texts = () => item.root.findAllByType('Text' as any).map((text) => text.props.children);
  mockPayments.push({ operationId: 'other-operation', published: true });
  await act(async () => {
    item = create(
      <HistoryItem entry={entry} displayAmount={10} position="only" onPress={jest.fn()} />,
    );
  });
  expect(texts()).toContain('Ecash created');
  mockPayments.push({ operationId: 'expected-operation', published: true });
  await act(async () => {
    item.update(
      <HistoryItem entry={{ ...entry }} displayAmount={10} position="only" onPress={jest.fn()} />,
    );
  });
  expect(texts()).toContain('Ecash delivered');
  expect(texts()).toContain('Ecash · Delivered');
  await act(async () => {
    item.update(
      <HistoryItem
        entry={{ ...entry, state: 'claimed' }}
        displayAmount={10}
        position="only"
        onPress={jest.fn()}
      />,
    );
  });
  expect(texts()).toContain('Ecash');
  expect(texts()).not.toContain('Ecash · Claimed');
  expect(texts()).not.toContain('Ecash · Confirmed');
  expect(item.root.findAllByType('RefreshCw' as any)).toHaveLength(0);
  await act(async () => item.unmount());
});

it('keeps quick filters usable when no activity matches', () => {
  act(() => pressable('Bitcoin').props.onPress());
  expect(transactionButtons()).toHaveLength(0);
  expect(pressable('Pending')).toBeDefined();
  expect(pressable('Sent')).toBeDefined();
  expect(pressable('Received')).toBeDefined();
});

const openSearch = () => {
  act(() => screen.update(<HistoryScreen showSearch />));
  return screen.root.findByType('Input' as any);
};

it('shows search only when opened, finds an older payment, and retains detail navigation', async () => {
  expect(screen.root.findAllByType('Input' as any)).toHaveLength(0);
  const input = openSearch();
  act(() => input.props.onChangeText('alice coffee'));
  expect(transactionButtons()).toHaveLength(1);
  act(() => transactionButtons()[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/txn-details',
    params: { id: 'older-coffee' },
  });
  const options = jest
    .mocked(useQuery)
    .mock.calls.map(([options]) => options)
    .find((options) => options.queryKey[1] === 'search' && options.enabled)!;
  await (options.queryFn as () => Promise<unknown>)();
  expect(historyService.getActivityHistory).toHaveBeenCalledWith(-1, 0);
});

it('combines search with quick filters and clears the query without resetting filters', () => {
  const input = openSearch();
  act(() => input.props.onChangeText('1000'));
  expect(transactionButtons()).toHaveLength(1);
  act(() => pressable('Received').props.onPress());
  expect(transactionButtons()).toHaveLength(0);
  expect(
    screen.root
      .findAllByType('Text' as any)
      .some((node) => node.props.children === 'No matching activity'),
  ).toBe(true);
  act(() => pressable('Clear history search').props.onPress());
  expect(transactionButtons()).toHaveLength(1);
  expect(transactionButtons()[0].props.accessibilityLabel).toContain('Received');
  expect(screen.root.findByType('Input' as any).props.value).toBe('');
});

it('clears search when its header control closes the bar', () => {
  const input = openSearch();
  act(() => input.props.onChangeText('coffee'));
  expect(transactionButtons()).toHaveLength(1);
  act(() => screen.update(<HistoryScreen showSearch={false} />));
  expect(screen.root.findAllByType('Input' as any)).toHaveLength(0);
  expect(transactionButtons()).toHaveLength(2);
  expect(openSearch().props.value).toBe('');
});

it('shows loading and retry states instead of a false empty result when full history is unavailable', () => {
  mockSearchLoading = true;
  const input = openSearch();
  act(() => input.props.onChangeText('coffee'));
  expect(screen.root.findAllByType('HistoryPageSkeleton' as any)).toHaveLength(1);
  mockSearchLoading = false;
  mockSearchError = true;
  act(() => screen.update(<HistoryScreen showSearch />));
  expect(
    screen.root
      .findAllByType('Text' as any)
      .some((node) => node.props.children === 'Could not search history'),
  ).toBe(true);
  const retry = screen.root
    .findAllByType('AppButton' as any)
    .find((node) => node.props.children === 'Try again')!;
  act(() => retry.props.onPress());
  expect(mockRefetchSearch).toHaveBeenCalledTimes(1);
});
