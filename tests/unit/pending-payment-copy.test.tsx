import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { PendingMintInvoiceLayout } from '~/features/history/components/PendingMintInvoiceLayout';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', useThemeName: () => 'dark' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentQRFrame', () => ({
  PaymentQRFrame: ({ children }: any) => children(260),
}));
jest.mock('~/shared/ui/PaymentQRCode', () => ({ __esModule: true, default: 'QR' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/shared/ui/PaymentStatusRow', () => ({ PaymentStatusRow: 'Status' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'List', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/PaymentActionsMenu', () => ({ PaymentActionsMenu: () => null }));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({ BUISheet: 'Sheet' }));
jest.mock('~/features/history/components/ReceiptImageShare', () => ({
  ReceiptImageShare: () => null,
}));
jest.mock('~/features/history/shareableReceipt', () => ({ buildShareableReceipt: () => null }));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ show: jest.fn(), showFeedback: jest.fn() }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

let tree: ReactTestRenderer;
afterEach(async () => act(async () => tree?.unmount()));
beforeEach(() => jest.clearAllMocks());
const copy = () => tree.root.findByType('Button' as any);
const invoice = (savedInvoice: string) => (
  <PendingMintInvoiceLayout
    savedInvoice={savedInvoice}
    timeLeft={60}
    entry={{
      id: 'invoice',
      amount: 100,
      unit: 'sat',
      mintUrl: 'https://mint.example',
      createdAt: 1,
      state: 'UNPAID',
    }}
    formattedStatus="Unpaid"
    primaryCurrency="SATS"
    secondaryCurrency="NONE"
    fiatAmount={0}
    isCheckingPaid
    onCancel={jest.fn()}
    onPaid={jest.fn()}
  />
);

it('copies the saved Lightning invoice during a status check while dismissal stays locked', async () => {
  await act(async () => {
    tree = create(invoice('lnbc-synthetic'));
  });
  expect(copy().props.disabled).toBe(false);
  expect(tree.root.findByType('Header' as any).props.disabled).toBe(true);
  await act(async () => copy().props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('lnbc-synthetic');
});

it.each(['deposit', 'withdrawal'] as const)(
  'copies the %s address during a status check',
  async (direction) => {
    const refresh = jest.fn();
    await act(async () => {
      tree = create(
        <PendingOnchainLayout
          direction={direction}
          amount={100}
          address="bitcoin:bc1qsynthetic?amount=0.000001"
          mint="Mint"
          checking
          onRefresh={refresh}
          onClose={jest.fn()}
        />,
      );
    });
    expect(copy().props.disabled).toBe(false);
    expect(tree.root.findByType('Header' as any).props.disabled).toBe(true);
    await act(async () => copy().props.onPress());
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('bc1qsynthetic');
    expect(refresh).not.toHaveBeenCalled();
  },
);

it('keeps Copy unavailable without a saved invoice or address', async () => {
  await act(async () => {
    tree = create(invoice(''));
  });
  expect(copy().props.disabled).toBe(true);
  await act(async () => {
    tree.update(
      <PendingOnchainLayout
        direction="deposit"
        amount={0}
        address=""
        mint="Mint"
        checking
        onRefresh={jest.fn()}
        onClose={jest.fn()}
      />,
    );
  });
  expect(copy().props.disabled).toBe(true);
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
});
