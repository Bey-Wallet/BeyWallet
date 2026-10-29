import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TransactionDetailsScreen } from '~/features/history/TransactionDetailsScreen';

const mockReclaim = jest.fn();
const mockReceive = jest.fn();
const mockStates = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteProofs = jest.fn();
const mockBalance = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn();
const mockCancelQueries = jest.fn();
const mockToast = jest.fn();
const mockPreventRemove = jest.fn();
const mockOffline = jest.fn();
let mockEntry: any;
let mockMintQuote: any = null;
let mockSnapshotPending = false;
const mockExpireUpdate = jest.fn();
const mockSetQuery = jest.fn((_key: unknown, update: (entry: any) => any) => {
  mockEntry = update(mockEntry);
});
const mockRepo = {
  historyRepository: {
    updateHistoryEntryState: mockUpdate,
    updateHistoryMintEntry: mockExpireUpdate,
  },
  proofRepository: { deleteProofs: mockDeleteProofs },
};
jest.mock('~/services/wallet/reclaimPayment', () => ({
  reclaimPayment: (...args: unknown[]) => mockReclaim(...args),
}));
jest.mock('~/services/wallet', () => ({
  initService: { getRepo: () => mockRepo, isInitialized: () => true },
  proofService: { checkProofStates: (...args: unknown[]) => mockStates(...args) },
  cleanToken: (value: string) => value,
  decodeToken: () => ({ proofs: [{ secret: 'synthetic' }] }),
  historyService: {},
  walletService: { receive: (...args: unknown[]) => mockReceive(...args) },
  quotesService: {},
}));
jest.mock('~/features/history/historyToken', () => ({
  getHistoryToken: () => 'synthetic-token',
  getVerifiedTokenState: (states: any[]) =>
    states[0]?.state === 'SPENT' ? 'claimed' : 'unclaimed',
}));
jest.mock('~/features/history/transactionNotes', () => ({ getTransactionNotes: () => [] }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ refreshBalance: mockBalance }) },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(() => ({ primaryCurrency: 'SATS', secondaryCurrency: 'USD' }), {
    getState: () => ({ notificationsEnabled: false }),
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => ({
    data:
      queryKey[0] === 'transaction'
        ? mockEntry
        : queryKey[0] === 'receiptSnapshot'
          ? {}
          : queryKey[0] === 'mintQuote'
            ? mockMintQuote
            : null,
    refetch: mockRefetch,
    isPending: queryKey[0] === 'receiptSnapshot' ? mockSnapshotPending : undefined,
    isRefetching: false,
  }),
  useQueryClient: () => ({
    setQueryData: mockSetQuery,
    invalidateQueries: mockInvalidate,
    cancelQueries: mockCancelQueries,
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({}),
  useLocalSearchParams: () => ({ id: 'entry' }),
  Stack: { Screen: 'Screen' },
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: mockToast }) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  ScrollView: 'ScrollView',
  Separator: 'Separator',
  YGroup: 'YGroup',
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));
jest.mock('@gandlaf21/bc-ur', () => ({}));
jest.mock('react-native-qrcode-svg', () => 'QR');
jest.mock('~/shared/ui/PendingTokenLayout', () => ({ PendingTokenLayout: 'PendingToken' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'HeaderButton' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'Table',
  ListTableRow: 'Row',
}));
jest.mock('~/features/history/components/TransactionReceiptSheet', () => ({
  TransactionReceiptSheet: ({ children, ...props }: any) =>
    require('react').createElement('ReceiptSheet', props, children),
}));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: any) => children,
}));
jest.mock('~/shared/ui/AppBottomSheet', () => ({ __esModule: true, default: 'Sheet' }));
jest.mock('~/features/history/components/PendingOnchainLayout', () => ({
  PendingOnchainLayout: 'Onchain',
}));
jest.mock('~/features/history/components/TransactionNoteRows', () => ({
  TransactionNoteRows: 'Notes',
}));
jest.mock('~/features/history/components/PendingMintInvoiceLayout', () => ({
  PendingMintInvoiceLayout: 'Invoice',
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ sqliteStorage: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: () => '1 sat', formatValue: () => '$0.01' },
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/platform/notificationService', () => ({ notificationService: {} }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => false }));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: () => mockOffline() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));

let tree: ReactTestRenderer;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mockMintQuote = null;
  mockSnapshotPending = false;
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  jest.clearAllMocks();
  mockEntry = {
    id: 'entry',
    mintUrl: 'https://mint.test',
    type: 'send',
    state: 'pending',
    amount: 1,
    unit: 'sat',
    createdAt: 1,
    metadata: {},
  };
  mockStates.mockReset().mockResolvedValue([{ state: 'UNSPENT' }]);
  mockReclaim.mockReset().mockResolvedValue('reclaimed');
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockDeleteProofs.mockReset().mockResolvedValue(undefined);
  mockBalance.mockReset().mockResolvedValue(undefined);
  mockRefetch.mockReset().mockResolvedValue(undefined);
  mockReceive.mockReset().mockResolvedValue(undefined);
  mockOffline.mockReset().mockResolvedValue(false);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
});
async function render() {
  await act(async () => {
    tree = create(<TransactionDetailsScreen />);
  });
  // The token is loaded in an effect. Let the first interval check that loaded token.
  await act(async () => jest.advanceTimersByTime(3000));
}
const pending = () => tree.root.findByType('PendingToken' as any);

it('waits for local receipt details before opening the final presentation', async () => {
  mockSnapshotPending = true;
  await render();
  expect(tree.root.findByType('ReceiptSheet' as any).props.ready).toBe(false);
  mockSnapshotPending = false;
  await act(async () => {
    tree.update(<TransactionDetailsScreen />);
  });
  expect(tree.root.findByType('ReceiptSheet' as any).props.ready).toBe(true);
});

it('does not turn a paid invoice into failure when its display expiry passes', async () => {
  mockEntry = { ...mockEntry, type: 'mint', state: 'PAID', quoteId: 'quote' };
  mockMintQuote = { expiry: Math.floor(Date.now() / 1000) - 1, state: 'PAID' };
  await render();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(mockExpireUpdate).not.toHaveBeenCalled();
  expect(mockEntry.state).toBe('PAID');
});

it('retires an expired invoice QR without writing a financial failure', async () => {
  mockEntry = {
    ...mockEntry,
    type: 'mint',
    state: 'UNPAID',
    quoteId: 'quote',
    paymentRequest: 'lnbc-synthetic-invoice',
  };
  // render() advances the initial polling clock by three seconds.
  mockMintQuote = { expiry: Math.floor(Date.now() / 1000) + 5, state: 'UNPAID' };
  await render();
  expect(tree.root.findAllByType('Invoice' as any)).toHaveLength(1);
  await act(async () => {
    jest.advanceTimersByTime(2500);
  });
  expect(tree.root.findAllByType('Invoice' as any)).toHaveLength(0);
  expect(mockExpireUpdate).not.toHaveBeenCalled();
  expect(mockEntry.state).toBe('UNPAID');
});

it('guards duplicate taps, pauses polling, and immediately displays persisted reclaim success', async () => {
  const operation = deferred<string>();
  mockReclaim.mockReturnValueOnce(operation.promise);
  await render();
  const refetches = mockRefetch.mock.calls.length;
  const reclaim = pending().props.onReclaim;
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => {
    first = reclaim();
    second = reclaim();
  });
  expect(mockReclaim).toHaveBeenCalledTimes(1);
  expect(pending().props.isReclaiming).toBe(true);
  expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  const polls = mockStates.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(9000));
  expect(mockStates).toHaveBeenCalledTimes(polls);
  await act(async () => {
    operation.resolve('reclaimed');
    await Promise.all([first, second]);
  });
  expect(mockEntry.state).toBe('expired');
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Reclaimed');
  expect(mockSetQuery).toHaveBeenCalledTimes(1);
  expect(mockCancelQueries).toHaveBeenCalledWith({
    queryKey: ['transaction', 'entry'],
    exact: true,
  });
  expect(mockUpdate).toHaveBeenLastCalledWith('entry', 'expired');
  expect(mockStates).toHaveBeenCalledTimes(polls);
  expect(mockRefetch).toHaveBeenCalledTimes(refetches); // No post-reclaim network refresh.
  expect(mockBalance).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('PendingToken' as any)).toHaveLength(0);
});

it('ignores a status response started before reclaim, including one arriving after success', async () => {
  const poll = deferred<any[]>();
  mockStates.mockReturnValueOnce(poll.promise);
  await render();
  expect(mockStates).toHaveBeenCalledTimes(1);
  await act(async () => pending().props.onReclaim());
  expect(mockEntry.state).toBe('expired');
  await act(async () => poll.resolve([{ state: 'SPENT' }]));
  expect(mockUpdate.mock.calls).toEqual([['entry', 'expired']]);
  expect(mockToast).not.toHaveBeenCalledWith(
    'The recipient has claimed your ecash',
    expect.anything(),
  );
});

it('prevents overlapping periodic status requests when the mint is slow', async () => {
  const poll = deferred<any[]>();
  mockStates.mockReturnValueOnce(poll.promise);
  await render();
  await act(async () => jest.advanceTimersByTime(9000));
  expect(mockStates).toHaveBeenCalledTimes(1);
  await act(async () => poll.resolve([{ state: 'UNSPENT' }]));
});

it('keeps an already-claimed result distinct and does not delete proofs as a refund', async () => {
  mockReclaim.mockResolvedValueOnce('claimed');
  await render();
  await act(async () => pending().props.onReclaim());
  expect(mockEntry.state).toBe('claimed');
  expect(mockDeleteProofs).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalledWith('Funds reclaimed to your wallet', expect.anything());
});

it('releases the guard after failure so reclaim can be retried', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockReclaim.mockRejectedValueOnce(new Error('Mint unavailable'));
    await render();
    await act(async () => pending().props.onReclaim());
    expect(pending().props.isReclaiming).toBe(false);
    expect(mockSetQuery).not.toHaveBeenCalled();
    await act(async () => pending().props.onReclaim());
    expect(mockReclaim).toHaveBeenCalledTimes(2);
    expect(mockEntry.state).toBe('expired');
  } finally {
    error.mockRestore();
  }
});

it('does not start manual reclaim while a legacy expiry sweep is already receiving', async () => {
  mockEntry.metadata = { expiresAt: 1 };
  const receive = deferred<void>();
  mockReceive.mockReturnValueOnce(receive.promise);
  mockRefetch.mockImplementation(async () => {
    if (mockUpdate.mock.calls.some(([, state]) => state === 'expired')) {
      mockEntry = { ...mockEntry, state: 'expired' };
    }
  });
  await render();
  expect(mockReceive).toHaveBeenCalledTimes(1);
  expect(pending().props.isReclaiming).toBe(true);
  await act(async () => pending().props.onReclaim());
  await act(async () => jest.advanceTimersByTime(9000));
  expect(mockReclaim).not.toHaveBeenCalled();
  expect(mockStates).toHaveBeenCalledTimes(1);
  await act(async () => receive.resolve());
  expect(mockUpdate).toHaveBeenLastCalledWith('entry', 'expired');
});

it('claims a saved receive once, blocks navigation, and updates immediately without a status recheck', async () => {
  mockEntry = { ...mockEntry, type: 'receive', state: 'unclaimed' };
  const receive = deferred<void>();
  mockReceive.mockReturnValueOnce(receive.promise);
  await render();
  const claim = pending().props.onClaim;
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => {
    first = claim();
    second = claim();
  });
  expect(mockReceive).toHaveBeenCalledTimes(1);
  expect(pending().props.isClaiming).toBe(true);
  expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => pending().props.onCheckStatus());
  expect(mockStates).not.toHaveBeenCalled();
  await act(async () => {
    receive.resolve();
    await Promise.all([first, second]);
  });
  expect(mockEntry.state).toBe('claimed');
  expect(mockUpdate).toHaveBeenLastCalledWith('entry', 'claimed');
  expect(mockSetQuery).toHaveBeenCalledTimes(1);
  expect(mockBalance).toHaveBeenCalledTimes(1);
  expect(mockRefetch).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('PendingToken' as any)).toHaveLength(0);
});

it('discards a saved-token status check that started before claim', async () => {
  mockEntry = { ...mockEntry, type: 'receive', state: 'unclaimed' };
  const status = deferred<any[]>();
  mockStates.mockReturnValueOnce(status.promise);
  await render();
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = pending().props.onCheckStatus();
  });
  await act(async () => pending().props.onClaim());
  await act(async () => {
    status.resolve([{ state: 'UNSPENT' }]);
    await refresh;
  });
  expect(mockUpdate.mock.calls).toEqual([['entry', 'claimed']]);
  expect(mockRefetch).not.toHaveBeenCalled();
});

it('leaves saved tokens unclaimed offline and releases the guard for an online retry', async () => {
  mockEntry = { ...mockEntry, type: 'receive', state: 'unclaimed' };
  mockOffline.mockResolvedValueOnce(true);
  await render();
  await act(async () => pending().props.onClaim());
  expect(mockReceive).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(pending().props.isClaiming).toBe(false);
  await act(async () => pending().props.onClaim());
  expect(mockEntry.state).toBe('claimed');
});

it('preserves the saved token after a failed claim and allows retry', async () => {
  mockEntry = { ...mockEntry, type: 'receive', state: 'unclaimed' };
  mockReceive.mockRejectedValueOnce(new Error('Mint unavailable'));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await render();
    await act(async () => pending().props.onClaim());
    expect(mockEntry.state).toBe('unclaimed');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(pending().props.isClaiming).toBe(false);
    await act(async () => pending().props.onClaim());
    expect(mockReceive).toHaveBeenCalledTimes(2);
    expect(mockEntry.state).toBe('claimed');
  } finally {
    error.mockRestore();
  }
});
