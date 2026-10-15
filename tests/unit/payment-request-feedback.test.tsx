import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentRequestStage } from '~/features/payments/send/PaymentRequestStage';
import { OperationFeedbackProvider } from '~/shared/ui/OperationFeedback';
import { type ParsedPaymentRequest } from '~/services/wallet/paymentRequestModel';

const mockToast = { show: jest.fn(), hide: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  NavigationContext: require('react').createContext(undefined),
}));
const mockDeliver = jest.fn();
const mockRefresh = jest.fn();
let mockResolveDelivery: () => void;
const mockPayment = {
  deliver: mockDeliver,
  refresh: mockRefresh,
  operationId: undefined as string | undefined,
  encoded: 'encoded',
  cost: { mintUrl: 'https://mint.test' },
};
const mockConstruct = jest.fn();
jest.mock('~/services/wallet/paymentRequestPayment', () => ({
  PaymentRequestPayment: function () {
    mockConstruct();
    return mockPayment;
  },
  previewPaymentRequest: async () => ({
    mintUrl: 'https://mint.test',
    totalDebit: 10,
    receiverFee: 0,
    senderFee: 0,
  }),
}));
jest.mock('~/services/wallet/paymentRequestModel', () => ({ isPaymentMintAllowed: () => true }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: () => ({
    balance: 100,
    activeMintUrl: 'https://mint.test',
    mints: [{ mintUrl: 'https://mint.test', name: 'Mint' }],
    balances: { 'https://mint.test': 100 },
    refreshMintList: jest.fn(),
  }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({ secondaryCurrency: 'USD', showBitcoinSymbol: false }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: 100000 } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: {
    convertSatsToCurrency: () => 0.01,
    formatSats: (value: number) => `${value} sats`,
  },
  SUPPORTED_CURRENCIES: [{ code: 'USD', symbol: '$' }],
}));
jest.mock('~/shared/ui/AppButton', () => ({
  AppButton: (props: unknown) => require('react').createElement('AppButton', props),
}));
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/shared/ui/HomeMintSelector', () => ({ MintSelectorSheet: 'MintSelectorSheet' }));
jest.mock('~/shared/ui/MintBalanceRow', () => ({ MintBalanceRow: 'MintBalanceRow' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@tamagui/toast', () => ({
  useToastController: () => mockToast,
  Toast: Object.assign((props: unknown) => require('react').createElement('Toast', props), {
    Title: 'ToastTitle',
    Description: 'ToastDescription',
  }),
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  Separator: 'Separator',
  View: 'View',
  H1: 'H1',
  ScrollView: 'ScrollView',
  Avatar: Object.assign((props: unknown) => require('react').createElement('Avatar', props), {
    Image: 'AvatarImage',
    Fallback: 'AvatarFallback',
  }),
}));

let tree: ReactTestRenderer;
const request = {
  raw: 'request',
  amount: 10,
  mints: ['https://mint.test'],
  description: 'Test',
} as ParsedPaymentRequest;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPayment.operationId = undefined;
  mockRefresh.mockResolvedValue(false);
  mockDeliver.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        mockResolveDelivery = resolve;
      }),
  );
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
});

async function render(autoPay: boolean, onSuccess = jest.fn()) {
  await act(async () => {
    tree = create(
      <OperationFeedbackProvider>
        <PaymentRequestStage
          request={request}
          autoPay={autoPay}
          onSuccess={onSuccess}
          onError={jest.fn()}
          onCancel={jest.fn()}
        />
      </OperationFeedbackProvider>,
    );
  });
  return onSuccess;
}

it('uses an automatic toast with no Pay button, then clears it while awaiting confirmed receipt', async () => {
  const onSuccess = await render(true);
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('AppButton' as any).some((n) => n.props.loading)).toBe(false);
  expect(mockDeliver).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockPayment.operationId = 'existing-operation';
    mockResolveDelivery();
  });
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  expect(mockToast.show).toHaveBeenCalledWith(
    'Payment sent; awaiting receipt',
    expect.objectContaining({ kind: 'info' }),
  );
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(9000));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('AppButton' as any).some((n) => n.props.loading)).toBe(false);
  mockRefresh.mockResolvedValue(true);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(onSuccess).toHaveBeenCalledWith(10, 'existing-operation', 'encoded');
});

it('keeps manual progress on Pay and reuses the existing payment for a failed delivery retry', async () => {
  mockDeliver.mockRejectedValueOnce(new Error('Relay unavailable'));
  await render(false);
  const pay = tree.root.findAllByType('AppButton' as any).find((n) => n.props.children === 'Pay')!;
  await act(async () => pay.props.onPress());
  expect(mockToast.show).toHaveBeenCalledWith(
    'Payment delivery failed',
    expect.objectContaining({ kind: 'error', message: 'Relay unavailable' }),
  );
  await act(async () => pay.props.onPress());
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  expect(
    tree.root.findAllByType('AppButton' as any).find((n) => n.props.loading)?.props.loadingText,
  ).toBe('Sending payment…');
  expect(mockConstruct).toHaveBeenCalledTimes(1);
  expect(mockDeliver).toHaveBeenCalledTimes(2);
  await act(async () => mockResolveDelivery());
});

it('exposes a manual retry after automatic delivery fails before an operation exists', async () => {
  mockDeliver.mockRejectedValueOnce(new Error('Offline'));
  await render(true);
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  const pay = tree.root.findAllByType('AppButton' as any).find((n) => n.props.children === 'Pay')!;
  expect(pay).toBeDefined();
  await act(async () => pay.props.onPress());
  expect(tree.root.findAllByType('Toast' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('AppButton' as any).find((n) => n.props.loading)).toBeDefined();
  await act(async () => mockResolveDelivery());
});
