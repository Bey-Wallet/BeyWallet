import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import MeltScreen from '~/features/payments/melt';

const mockWallet = {
  activeMintUrl: 'mint-a',
  balances: { 'mint-a': 100, 'mint-b': 100 },
  mints: [
    { mintUrl: 'mint-a', name: 'Mint A' },
    { mintUrl: 'mint-b', name: 'Mint B' },
  ],
  scannerResult: null as string | null,
  setScannerResult: jest.fn((value) => {
    mockWallet.scannerResult = value;
  }),
  refreshBalance: jest.fn(),
  refreshMintList: jest.fn(),
  isInitializing: false,
  isRefreshing: false,
};
const mockPreview = jest.fn();
const mockPay = jest.fn();
const mockPayments: any[] = [];
const mockOffline = jest.fn();
const mockRequestInvoice = jest.fn();
const mockParams = jest.fn();
const mockClipboard = jest.fn();
const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockSettings = { primaryCurrency: 'SATS', secondaryCurrency: 'USD' };

jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select?: (s: typeof mockWallet) => unknown) =>
    select ? select(mockWallet) : mockWallet,
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(() => mockSettings, {
    getState: () => ({ biometricEnabled: false }),
  }),
}));
jest.mock('~/services/wallet/lightningPayment', () => ({
  LightningPayment: jest.fn().mockImplementation((mintUrl, invoice) => {
    const payment = {
      mintUrl,
      invoice,
      preview: jest.fn(() => mockPreview(mintUrl, invoice)),
      dispose: jest.fn(async () => {}),
      pay: mockPay,
    };
    mockPayments.push(payment);
    return payment;
  }),
}));
jest.mock('~/services/api/lnurlService', () => ({
  ...jest.requireActual('~/services/api/lnurlService'),
  getLnurlPayParams: (...args: unknown[]) => mockParams(...args),
  requestInvoiceFromLnurl: (...args: unknown[]) => mockRequestInvoice(...args),
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: () => mockOffline() },
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: jest.fn() },
}));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/features/payments/melt/OnchainMeltFlow', () => ({
  OnchainMeltFlow: 'OnchainMeltFlow',
}));
jest.mock('~/features/payments/melt/ResultStage', () => ({ MeltResultStage: 'MeltResultStage' }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Stack: { Screen: 'Screen' },
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('@tamagui/lucide-icons', () => ({ Zap: 'Zap', ArrowUpDown: 'ArrowUpDown' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'PaymentAmount' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ MintSelectorSheet: 'MintSelectorSheet' }));
jest.mock('~/shared/ui/DestinationInputRow', () => ({
  DestinationInputRow: 'DestinationInputRow',
}));
jest.mock('~/shared/ui/MintBalanceRow', () => ({ MintBalanceRow: 'MintBalanceRow' }));
jest.mock('~/shared/ui/BouncyAmount', () => ({ BouncyAmount: 'BouncyAmount' }));
jest.mock('~/shared/ui/NumericKeypad', () => ({ NumericKeypad: 'NumericKeypad' }));

let tree: ReactTestRenderer;
const destination = () => tree.root.findByType('DestinationInputRow' as any);
const keypad = () => tree.root.findByType('NumericKeypad' as any);
const quote = (amount = 20) => ({
  amount,
  fee_reserve: 2,
  quote: 'quote-id',
  expiry: Math.floor(Date.now() / 1000) + 60,
});
async function open() {
  await act(async () => {
    tree = create(<MeltScreen />);
  });
}
async function enter(value: string) {
  await act(async () => destination().props.onChangeText(value));
}
async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
}
const payButton = () => tree.root.findByProps({ children: 'Pay' });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSettings.primaryCurrency = 'SATS';
  mockSettings.secondaryCurrency = 'USD';
  mockPayments.length = 0;
  mockWallet.scannerResult = null;
  mockWallet.balances['mint-a'] = 100;
  mockPreview.mockResolvedValue(quote());
  mockOffline.mockResolvedValue(false);
  mockParams.mockResolvedValue({ minSendable: 1000, maxSendable: 1000000 });
  mockRequestInvoice.mockResolvedValue('lnbc20n1resolved-invoice');
  mockClipboard.mockResolvedValue('lightning:lnbc20n1pasted-invoice');
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
});

it('uses integer sats and Max without a rate or a currency switch when None is selected', async () => {
  mockSettings.primaryCurrency = 'FIAT';
  mockSettings.secondaryCurrency = 'NONE';
  await open();
  expect(keypad().props.allowDecimal).toBe(false);
  expect(tree.root.findByType('BouncyAmount' as any).props.suffix).toBe(' sat');
  expect(tree.root.findAllByType('ArrowUpDown' as any)).toHaveLength(0);
  await act(async () => keypad().props.onValueChange('42'));
  expect(keypad().props.value).toBe('42');
  await act(async () => keypad().props.onValueChange('1.5'));
  expect(keypad().props.value).toBe('42');
  await act(async () => tree.root.findByType('MintBalanceRow' as any).props.onMaxPress());
  expect(keypad().props.value).toBe('100');
  expect(mockSettings.primaryCurrency).toBe('FIAT');
});

it.each(['lnbc20n1invoice', 'LIGHTNING:LNBC20N1INVOICE', 'lntb20n1invoice', 'lnbcrt20n1invoice'])(
  'detects %s and opens confirmation without editable amount entry or executing payment',
  async (invoice) => {
    await open();
    await enter(invoice);
    expect(tree.root.findAllByType('NumericKeypad' as any)).toHaveLength(0);
    expect(tree.root.findByType('MintBalanceRow' as any).props.showMax).toBe(false);
    await settle();
    expect(tree.root.findByType('PaymentAmount' as any).props.amount).toBe(20);
    expect(payButton().props.disabled).toBeFalsy();
    expect(mockPay).not.toHaveBeenCalled();
    expect(mockPreview.mock.calls[0][1]).not.toMatch(/^lightning:/i);
  },
);

it('detects a pasted invoice and skips the amount stage', async () => {
  await open();
  await act(async () => destination().props.onPaste());
  await settle();
  expect(mockPreview).toHaveBeenCalledWith('mint-a', 'lnbc20n1pasted-invoice');
  expect(tree.root.findAllByType('NumericKeypad' as any)).toHaveLength(0);
  expect(payButton()).toBeTruthy();
});

it('detects an incoming scanned or universal-input invoice without an extra Continue tap', async () => {
  mockWallet.scannerResult = 'lightning:lnbc20n1scanned-invoice';
  await open();
  await settle();
  expect(mockWallet.setScannerResult).toHaveBeenCalledWith(null);
  expect(tree.root.findByType('PaymentAmount' as any).props.amount).toBe(20);
  expect(mockPay).not.toHaveBeenCalled();
});

it('waits for typing to settle before preparing an invoice', async () => {
  await open();
  await enter('lnbc20');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(150);
  });
  await enter('lnbc20n1complete-invoice');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(299);
  });
  expect(mockPreview).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(mockPreview).toHaveBeenCalledTimes(1);
});

it.each(['user@example.com', 'lnurlp://example.com/pay'])(
  'keeps amount entry for %s and resolves only after Continue',
  async (address) => {
    await open();
    await enter(address);
    await settle();
    expect(mockPreview).not.toHaveBeenCalled();
    expect(mockRequestInvoice).not.toHaveBeenCalled();
    expect(keypad().props.confirmDisabled).toBe(true);
    await act(async () => keypad().props.onValueChange('20'));
    await act(async () => keypad().props.onConfirm());
    expect(mockRequestInvoice).toHaveBeenCalledWith(address, 20);
    expect(tree.root.findByProps({ label: 'Recipient' }).props.value).toBe(address);
    expect(payButton()).toBeTruthy();
  },
);

it.each(['expired', 'amountless', 'invalid'])(
  'does not advance or pay an %s invoice',
  async (kind) => {
    if (kind === 'invalid') mockPreview.mockRejectedValue(new Error('Invalid invoice'));
    else mockPreview.mockResolvedValue(kind === 'expired' ? { ...quote(), expiry: 1 } : quote(0));
    await open();
    await enter('lnbc1bad-invoice');
    await settle();
    expect(tree.root.findAllByType('PaymentAmount' as any)).toHaveLength(0);
    expect(destination()).toBeTruthy();
    expect(mockPay).not.toHaveBeenCalled();
    expect(mockPayments[0].dispose).toHaveBeenCalledTimes(1);
  },
);

it('keeps an insufficient-balance invoice in confirmation with Pay disabled', async () => {
  mockWallet.balances['mint-a'] = 10;
  await open();
  await enter('lnbc20n1invoice');
  await settle();
  expect(payButton().props.disabled).toBe(true);
  expect(mockPay).not.toHaveBeenCalled();
});

it('ignores a stale quote after switching mints and releases the obsolete preparation first', async () => {
  let resolve!: (value: unknown) => void;
  mockPreview.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await open();
  await enter('lnbc20n1invoice');
  await settle();
  await act(async () => tree.root.findByType('MintSelectorSheet' as any).props.onSelect('mint-b'));
  mockPreview.mockResolvedValue(quote(30));
  await settle();
  expect(mockPayments[0].dispose).toHaveBeenCalled();
  expect(mockPayments[0].dispose.mock.invocationCallOrder[0]).toBeLessThan(
    mockPayments[1].preview.mock.invocationCallOrder[0],
  );
  await act(async () => resolve(quote(99)));
  expect(tree.root.findByType('PaymentAmount' as any).props.amount).toBe(30);
  expect(mockWallet.activeMintUrl).toBe('mint-a');
});

it('returns to invoice editing on Back without immediately advancing again', async () => {
  await open();
  await enter('lnbc20n1invoice');
  await settle();
  await act(async () => tree.root.findByType('PaymentFlowHeader' as any).props.onBack());
  await settle();
  expect(destination()).toBeTruthy();
  expect(tree.root.findAllByType('PaymentAmount' as any)).toHaveLength(0);
  await enter('user@example.com');
  expect(keypad()).toBeTruthy();
  expect(mockPay).not.toHaveBeenCalled();
});

it('keeps offline invoice input editable and does not prepare or execute payment', async () => {
  mockOffline.mockResolvedValue(true);
  await open();
  await enter('lnbc20n1invoice');
  await settle();
  expect(mockPreview).not.toHaveBeenCalled();
  expect(mockPay).not.toHaveBeenCalled();
  expect(destination()).toBeTruthy();
});
