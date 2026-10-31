jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
import React from 'react';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
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
const mockPreview = jest.fn(async (_request: unknown, _mint: string, amountMode = 'net') => ({
  mintUrl: 'https://mint.test',
  amountMode,
  amount: 10,
  grossAmount: 10,
  totalDebit: 10,
  receiverFee: amountMode === 'exact' ? 1 : 0,
  senderFee: 0,
}));
jest.mock('~/services/wallet/paymentRequestPayment', () => ({
  requestPaymentKey: () => 'request-key',
  PaymentRequestPayment: function (...args: unknown[]) {
    mockConstruct(...args);
    return mockPayment;
  },
  previewPaymentRequest: (...args: Parameters<typeof mockPreview>) => mockPreview(...args),
}));
jest.mock('~/services/wallet/requestLifecycleService', () => ({
  requestLifecycleService: { reconcile: jest.fn() },
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: require('zustand').create(() => ({ payments: [] })),
}));
import { useNostrRequestStore } from '~/state/nostrRequestStore';
jest.mock('~/services/wallet/paymentRequestModel', () => ({ isPaymentMintAllowed: () => true }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: () => ({
    balance: 100,
    activeMintUrl: 'https://mint.test',
    mints: [{ mintUrl: 'https://mint.test', name: 'Mint', trusted: true }],
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
    formatValue: () => '$0.01',
    convertSatsToCurrency: () => 0.01,
    formatSats: (value: number) => `${value} sat`,
  },
  SUPPORTED_CURRENCIES: [{ code: 'USD', symbol: '$' }],
}));
jest.mock('~/shared/ui/AppButton', () => ({
  AppButton: (props: unknown) => require('react').createElement('AppButton', props),
}));
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
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
  useNostrRequestStore.setState({ payments: [] });
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

async function render(autoPay: boolean, onSuccess = jest.fn(), paymentRequest = request) {
  await act(async () => {
    tree = create(
      <OperationFeedbackProvider>
        <PaymentRequestStage
          request={paymentRequest}
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
  expect(mockToast.show).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(9000));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('AppButton' as any).some((n) => n.props.loading)).toBe(false);
  await act(async () =>
    useNostrRequestStore.setState({
      payments: [
        { id: 'request-key', state: 'paid', operationId: 'existing-operation', published: true },
      ],
    }),
  );
  expect(onSuccess).toHaveBeenCalledWith(10, 'existing-operation', 'encoded');
});

it('keeps manual progress on Pay and reuses the existing payment for a failed delivery retry', async () => {
  mockDeliver.mockRejectedValueOnce(new Error('Relay unavailable'));
  await render(false);
  const pay = tree.root.findAllByType('AppButton' as any).find((n) => n.props.children === 'Pay')!;
  await act(async () => pay.props.onPress());
  expect(mockToast.show).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((node) => node.props.children === 'Relay unavailable'),
  ).toBe(true);
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

it('requires opt-in for the legacy quote, shows the net amount, and locks the mode during delivery', async () => {
  const nostrRequest = { ...request, delivery: 'nip17' as const };
  await render(false, jest.fn(), nostrRequest);
  const toggle = () =>
    tree.root.findByProps({ accessibilityLabel: 'Exact amount for legacy wallets' });
  expect(toggle().props.checked).toBe(false);
  await act(async () => toggle().props.onCheckedChange(true));
  expect(mockPreview).toHaveBeenLastCalledWith(nostrRequest, 'https://mint.test', 'exact');
  expect(tree.root.findByProps({ label: 'Recipient receives after fees' }).props.value).toBe(
    '9 sat',
  );
  expect(
    tree.root
      .findAllByProps({ accessibilityRole: 'alert' })
      .some((node) => JSON.stringify(node.props.children).includes('recipient pays')),
  ).toBe(true);
  const pay = () =>
    tree.root.findAllByType('AppButton' as any).find((n) => n.props.children === 'Pay')!;
  await act(async () => pay().props.onPress());
  expect(mockConstruct).toHaveBeenCalledWith(
    nostrRequest,
    expect.objectContaining({ amountMode: 'exact' }),
    undefined,
  );
  expect(toggle().props.disabled).toBe(true);
  await act(async () => toggle().props.onCheckedChange(false));
  expect(toggle().props.checked).toBe(true);
  await act(async () => mockResolveDelivery());
  expect(toggle().props.disabled).toBe(true);
});

it('never offers legacy mode for automatic NFC payments', async () => {
  await render(true, jest.fn(), { ...request, delivery: 'nfc' });
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Exact amount for legacy wallets' }),
  ).toHaveLength(0);
  expect(mockPreview).toHaveBeenLastCalledWith(expect.anything(), 'https://mint.test', 'net');
  await act(async () => mockResolveDelivery());
});
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => false }));
