jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { PaymentStage } from '~/features/payments/mint/PaymentStage';
import { ResultStage } from '~/features/payments/mint/ResultStage';

let mockPrimaryCurrency = 'SATS';
const mockToastShow = jest.fn();

jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  ScrollView: 'ScrollView',
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Check: 'Check',
  X: 'X',
  Clock: 'Clock',
  Minus: 'Minus',
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(
    () => ({
      primaryCurrency: mockPrimaryCurrency,
      secondaryCurrency: 'USD',
      showBitcoinSymbol: false,
    }),
    { getState: () => ({ showBitcoinSymbol: false }) },
  ),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector?: (state: unknown) => unknown) => {
    const state = { mints: [{ mintUrl: 'https://mint.example', nickname: 'My mint' }] };
    return selector ? selector(state) : state;
  },
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: 100000 } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: mockToastShow }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPrimaryCurrency = 'SATS';
});
afterEach(() => jest.useRealTimers());

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const paymentProps = {
  amount: '10000',
  invoice: 'lnbc-test-invoice-with-a-long-payment-request',
  quoteId: 'quote-1',
  mintUrl: 'https://mint.example',
  onPaid: jest.fn(),
  onCancel: jest.fn(),
};

function button(tree: ReactTestRenderer, label: string) {
  return tree.root.findAllByType('AppButton' as any).find((node) => node.props.children === label)!;
}

it.each(['SATS', 'FIAT'])(
  'keeps %s primary across payment and success screens',
  async (currency) => {
    mockPrimaryCurrency = currency;
    const primary = currency === 'SATS' ? '10,000 SATS' : '$10.00';
    const secondary = currency === 'SATS' ? '≈ $10.00' : '≈ 10,000 SATS';
    const payment = await render(<PaymentStage {...paymentProps} />);
    const result = await render(
      <ResultStage
        status="success"
        amount="10000"
        mintUrl="https://mint.example/"
        onClose={jest.fn()}
      />,
    );
    expect(payment.root.findByProps({ testID: 'mint-payment-primary-amount' }).props.children).toBe(
      primary,
    );
    expect(
      payment.root.findByProps({ testID: 'mint-payment-secondary-amount' }).props.children,
    ).toBe(secondary);
    expect(result.root.findByProps({ testID: 'mint-result-primary-amount' }).props.children).toBe(
      primary,
    );
    expect(result.root.findByProps({ testID: 'mint-result-secondary-amount' }).props.children).toBe(
      secondary,
    );
    expect(
      result.root
        .findAllByType('ListTableRow' as any)
        .map(({ props }) => [props.label, props.value, props.icon]),
    ).toEqual([
      ['Mint', 'My mint', undefined],
      [
        'Time',
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        undefined,
      ],
    ]);
    await act(async () => {
      payment.unmount();
      result.unmount();
    });
  },
);

it('copies the complete invoice and sizes the QR to the available space', async () => {
  const tree = await render(<PaymentStage {...paymentProps} />);
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Lightning invoice QR code' })
      .props.onLayout({ nativeEvent: { layout: { width: 260 } } }),
  );
  expect(tree.root.findByType('QRCode' as any).props).toMatchObject({
    value: paymentProps.invoice,
    size: 220,
  });
  const invoiceRow = tree.root.findByProps({ label: 'Invoice' });
  expect(invoiceRow.props.value).not.toBe(paymentProps.invoice);
  expect(invoiceRow.props.copyValue).toBe(paymentProps.invoice);
  expect(invoiceRow.props.isCopyable).toBe(true);
  expect(tree.root.findByProps({ label: 'Mint' }).props.value).toBe('My mint');
  await act(async () => invoiceRow.props.onCopy());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(paymentProps.invoice);
  expect(paymentProps.onPaid).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('replaces payment controls and QR when the invoice expires', async () => {
  const expiry = Math.floor(Date.now() / 1000) + 2;
  const tree = await render(<PaymentStage {...paymentProps} expiry={expiry} />);
  await act(async () => jest.advanceTimersByTime(2000));
  expect(tree.root.findByProps({ label: 'Invoice' }).props.disabled).toBe(true);
  expect(tree.root.findByProps({ label: 'Expires in' }).props.value).toBe('Expired');
  expect(button(tree, 'Check payment')).toBeUndefined();
  expect(tree.root.findAllByType('QRCode' as any)).toHaveLength(0);
  await act(async () => button(tree, 'Close invoice').props.onPress());
  expect(paymentProps.onCancel).toHaveBeenCalledTimes(1);
  expect(paymentProps.onPaid).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('keeps the invoice available after an unsuccessful payment check', async () => {
  const onPaid = jest.fn().mockRejectedValue(new Error('Not paid'));
  const tree = await render(<PaymentStage {...paymentProps} onPaid={onPaid} />);
  await act(async () => button(tree, 'Check payment').props.onPress());
  expect(onPaid).toHaveBeenCalledTimes(1);
  expect(mockToastShow).toHaveBeenCalledWith(expect.any(String), { kind: 'info' });
  expect(button(tree, 'Check payment').props.loading).toBe(false);
  expect(tree.root.findByProps({ label: 'Invoice' }).props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

it('keeps technical errors behind details and closes through the existing callback', async () => {
  const onClose = jest.fn();
  const tree = await render(
    <ResultStage status="error" amount="10000" error="Mint request timed out" onClose={onClose} />,
  );
  const errorNodes = () =>
    tree.root
      .findAllByType('Text' as any)
      .filter(({ props }) => props.children === 'Mint request timed out');
  expect(errorNodes()).toHaveLength(0);
  await act(async () => button(tree, 'View details').props.onPress());
  expect(errorNodes()).toHaveLength(1);
  expect(button(tree, 'Hide details').props.accessibilityState.expanded).toBe(true);
  await act(async () => button(tree, 'Done').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('shows cancellation without an error or success message', async () => {
  const tree = await render(<ResultStage status="cancelled" amount="10000" onClose={jest.fn()} />);
  const text = tree.root.findAllByType('Text' as any).map(({ props }) => props.children);
  expect(text).toContain('Top-up cancelled');
  expect(text).not.toContain('Funds added');
  expect(button(tree, 'View details')).toBeUndefined();
  await act(async () => tree.unmount());
});

it.each([undefined, 0, -1, NaN, Infinity, 5])(
  'shows a fee only when it is confirmed and positive (%s)',
  async (feeSats) => {
    const tree = await render(
      <ResultStage status="success" amount="10000" feeSats={feeSats} onClose={jest.fn()} />,
    );
    const rows = tree.root.findAllByType('ListTableRow' as any);
    const feeRow = rows.find(({ props }) => props.label === 'Fee');
    if (feeSats === 5) {
      expect(feeRow?.props.value).toBe('5 SATS');
    } else {
      expect(feeRow).toBeUndefined();
    }
    const time = tree.root.findByProps({ label: 'Time' }).props.value;
    await act(async () => jest.advanceTimersByTime(60000));
    expect(tree.root.findByProps({ label: 'Time' }).props.value).toBe(time);
    await act(async () => tree.unmount());
  },
);
