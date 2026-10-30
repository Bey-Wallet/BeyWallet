import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PendingMintInvoiceLayout } from '~/features/history/components/PendingMintInvoiceLayout';

jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, footer, children }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentStatusRow', () => ({ PaymentStatusRow: 'Status' }));
jest.mock('~/shared/ui/PaymentQRFrame', () => ({
  PaymentQRFrame: ({ children }: any) => children(240),
}));
jest.mock('~/shared/ui/PaymentQRCode', () => 'QR');
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ showFeedback: jest.fn() }),
}));
const props = {
  savedInvoice: 'lnbc-synthetic-invoice',
  timeLeft: 60,
  entry: { id: 'entry', amount: 64, unit: 'sat', mintUrl: 'mint', createdAt: 1, state: 'paid' },
  formattedStatus: 'Paid',
  primaryCurrency: 'SATS',
  secondaryCurrency: 'NONE',
  fiatAmount: 0,
  isCheckingPaid: false,
  onCancel: jest.fn(),
  onPaid: jest.fn(),
};
let tree: ReactTestRenderer;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('shows a paid top-up as awaiting ecash, removes its QR and cancel action, and offers collection', async () => {
  await act(async () => {
    tree = create(<PendingMintInvoiceLayout {...props} />);
  });
  expect(tree.root.findAllByType('QR' as any)).toHaveLength(0);
  expect(tree.root.findByType('Status' as any).props.value).toBe('Awaiting ecash');
  const buttons = tree.root.findAllByType('Button' as any);
  expect(buttons.map((button) => button.props.children)).toEqual(['Collect ecash']);
  expect(props.onPaid).not.toHaveBeenCalled();
  await act(async () => buttons[0].props.onPress());
  expect(props.onPaid).toHaveBeenCalledTimes(1);
  expect(props.onCancel).not.toHaveBeenCalled();
});

it('preserves an unpaid invoice QR and refresh without an extra check button', async () => {
  await act(async () => {
    tree = create(
      <PendingMintInvoiceLayout {...props} entry={{ ...props.entry, state: 'UNPAID' }} />,
    );
  });
  expect(tree.root.findByType('QR' as any).props.value).toBe(props.savedInvoice);
  expect(tree.root.findByType('Status' as any).props.value).toBe('Awaiting payment');
  expect(tree.root.findAllByType('Button' as any).map((button) => button.props.children)).toEqual([
    'Cancel',
  ]);
});

it.each([true, false])('blocks collection while offline=%s or busy', async (offline) => {
  await act(async () => {
    tree = create(
      <PendingMintInvoiceLayout {...props} offline={offline} isCheckingPaid={!offline} />,
    );
  });
  expect(tree.root.findByType('Button' as any).props.disabled).toBe(true);
  expect(props.onPaid).not.toHaveBeenCalled();
});
