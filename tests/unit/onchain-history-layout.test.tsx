import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import {
  historyPaymentLayout,
  isOnchainHistory,
  onchainMeltOutcome,
} from '~/features/history/transactionPresentation';

jest.mock('tamagui', () => ({ Text: 'Text' }));
jest.mock('@tamagui/lucide-icons', () => ({ RefreshCw: 'RefreshCw' }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentQRFrame', () => ({
  PaymentQRFrame: ({ children, ...props }: any) =>
    require('react').createElement('QRFrame', props, children(240)),
}));
jest.mock('~/shared/ui/PaymentQRCode', () => 'QRCode');
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));

const address = 'bc1q' + 'a'.repeat(38);
const onchain = { type: 'melt', metadata: { via: 'onchain', address } };
const staleInvoice = 'lnbc1previous-top-up';

it.each(['PAID', 'completed', 'failed', 'error', 'cancelled'])(
  'opens terminal on-chain withdrawals as receipts even with a stale invoice (%s)',
  (state) => {
    expect(historyPaymentLayout({ ...onchain, state }, staleInvoice)).toBe('receipt');
  },
);
it.each(['PENDING', 'pending', 'UNPAID'])(
  'gives pending withdrawals a receipt layout and pending deposits a Bitcoin QR (%s)',
  (state) => {
    expect(historyPaymentLayout({ ...onchain, state }, staleInvoice)).toBe('onchain-withdrawal');
    expect(
      historyPaymentLayout(
        { ...onchain, type: 'mint', state, paymentRequest: address },
        staleInvoice,
      ),
    ).toBe('onchain-deposit');
  },
);
it.each(['paid', 'issued', 'failed'])(
  'never reopens a completed on-chain deposit as a Lightning invoice (%s)',
  (state) => {
    expect(historyPaymentLayout({ ...onchain, type: 'mint', state }, address)).toBe('receipt');
  },
);
it('keeps invoice QR screens exclusive to pending Lightning top-ups', () => {
  expect(historyPaymentLayout({ type: 'mint', state: 'UNPAID' }, staleInvoice)).toBe(
    'lightning-invoice',
  );
  expect(historyPaymentLayout({ type: 'melt', state: 'UNPAID' }, staleInvoice)).toBe('receipt');
  expect(historyPaymentLayout({ type: 'mint', state: 'ISSUED' }, staleInvoice)).toBe('receipt');
  expect(historyPaymentLayout({ type: 'mint', state: 'PAID' }, address)).toBe('receipt');
});
it('recognizes serialized metadata and older on-chain address records', () => {
  expect(isOnchainHistory({ ...onchain, metadata: JSON.stringify(onchain.metadata) })).toBe(true);
  expect(isOnchainHistory({ type: 'mint', paymentRequest: `bitcoin:${address}?amount=0.01` })).toBe(
    true,
  );
  expect(isOnchainHistory({ type: 'mint', paymentRequest: staleInvoice })).toBe(false);
  expect(isOnchainHistory({ type: 'mint', metadata: '{invalid json' })).toBe(false);
});
it.each([
  ['PAID', 'paid'],
  ['FAILED', 'failed'],
  ['UNPAID', 'failed'],
  ['PENDING', 'pending'],
  [undefined, 'pending'],
  ['unrecognized', 'pending'],
])('distinguishes completed, failed and unresolved acknowledgements (%s)', (state, expected) => {
  expect(onchainMeltOutcome(state)).toBe(expected);
});

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const props = {
  amount: 250,
  address,
  mint: 'Example mint',
  onRefresh: jest.fn(),
  onClose: jest.fn(),
};

it('shows an outgoing pending receipt with status refresh, full address copy and no QR', async () => {
  await act(async () => {
    tree = create(<PendingOnchainLayout {...props} direction="withdrawal" />);
  });
  expect(tree.root.findAllByType('QRCode' as any)).toHaveLength(0);
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
  const row = tree.root.findByProps({ label: 'Status' });
  expect(row.props.value).toBe('Pending');
  await act(async () => row.props.rightContent.props.onPress());
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const destination = tree.root.findByProps({ label: 'Destination' });
  expect(destination.props.isCopyable).toBe(true);
  expect(destination.props.copyValue).toBe(address);
});

it('keeps a deposit QR as Bitcoin and copies the full destination', async () => {
  await act(async () => {
    tree = create(
      <PendingOnchainLayout
        {...props}
        amount={0}
        address={`bitcoin:${address}?amount=0.01`}
        direction="deposit"
      />,
    );
  });
  expect(tree.root.findByType('QRCode' as any).props.value).toBe(`bitcoin:${address}?amount=0.01`);
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Awaiting payment');
  expect(tree.root.findByProps({ label: 'Address' }).props.copyValue).toBe(address);
  expect(tree.root.findAllByType('Amount' as any)).toHaveLength(0);
});
