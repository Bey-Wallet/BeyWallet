import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import Screen from '~/features/history/WalletActivityDetailsScreen';
const mockReplace = jest.fn();
const mockClose = jest.fn();
const mockHide = jest.fn(async () => {});
const mockReceiptId = jest.fn(async () => 'saved-history-row');
const mockRefetch = jest.fn();
let mockActivity: any;
let mockFailed = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 'activity:one' }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockActivity,
    isError: mockFailed,
    isLoading: false,
    refetch: mockRefetch,
  }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: any) => children,
}));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: 'public-wallet' }),
}));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/AppTextButton', () => ({ AppTextButton: 'Button' }));
jest.mock('~/shared/ui/ReceiptSheetContext', () => ({
  useReceiptSheet: () => ({ close: mockClose }),
}));
jest.mock('~/features/history/components/TransactionReceiptSheet', () => ({
  TransactionReceiptSheet: ({ children, ...props }: any) =>
    require('react').createElement('Receipt', props, children),
}));
jest.mock('~/features/history/components/ReceiptExtraDetails', () => ({
  ReceiptExtraDetails: 'ExtraDetails',
}));
jest.mock('~/services/wallet/walletActivityService', () => ({
  getWalletActivity: jest.fn(),
  hideWalletActivity: (...args: any[]) => (mockHide as any)(...args),
  getOptimizationReceiptId: (...args: any[]) => (mockReceiptId as any)(...args),
  subscribeWalletActivity: () => () => {},
}));
jest.mock('~/services/wallet/eventService', () => ({ eventService: { on: () => () => {} } }));
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockFailed = false;
  mockActivity = {
    id: 'activity:one',
    kind: 'optimize',
    mintUrls: ['https://mint.test'],
    state: 'completed',
    createdAt: Date.now(),
    fee: null,
    balanceDelta: null,
    inputAmount: 32,
    operationId: 'send-operation',
  };
});
afterEach(() => act(() => tree?.unmount()));
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((node) => node.props.children === label)!;

it('uses a compact settled receipt with explicit unavailable fees and no extra payment amount', async () => {
  await act(async () => {
    tree = create(<Screen />);
  });
  expect(tree.root.findByType('Receipt' as any).props.active).toBe(false);
  expect(
    tree.root.findAllByType('Row' as any).find((row) => row.props.label === 'Fee')?.props.value,
  ).toBe('Unavailable');
  expect(tree.root.findAllByType('Table' as any)[0].props.variant).toBe('outlined');
});
it('routes review to the saved history row, never the operation ID or a financial action', async () => {
  mockActivity.state = 'review';
  await act(async () => {
    tree = create(<Screen />);
  });
  expect(tree.root.findByType('Receipt' as any).props.active).toBe(true);
  expect(button('Remove from History')).toBeUndefined();
  await act(async () => {
    await button('Review operation').props.onPress();
  });
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/txn-details',
    params: { id: 'saved-history-row' },
  });
});
it('requires confirmation before hiding a settled entry and closes after saving', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    tree = create(<Screen />);
  });
  button('Remove from History').props.onPress();
  expect(mockHide).not.toHaveBeenCalled();
  const confirm = alert.mock.calls[0][2]!.find((action) => action.text === 'Remove')!;
  await act(async () => {
    confirm.onPress!();
  });
  expect(mockHide).toHaveBeenCalledWith('activity:one');
  expect(mockClose).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
it('keeps missing items and load failures readable with a safe retry', async () => {
  mockActivity = null;
  mockFailed = true;
  await act(async () => {
    tree = create(<Screen />);
  });
  button('Try again').props.onPress();
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
