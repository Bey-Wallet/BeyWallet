import React from 'react';
import * as Clipboard from 'expo-clipboard';
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/PaymentAmountRow', () => ({ PaymentAmountRow: 'AmountRow' }));
jest.mock('~/features/history/components/ReceiptImageShare', () => ({
  ReceiptImageShare: 'ReceiptShare',
}));
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PendingOnchainLayout } from '~/features/history/components/PendingOnchainLayout';
import { OnchainPaymentStatus } from '~/features/payments/OnchainPaymentStatus';
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (amount: number) => `${amount} sat` },
}));
import {
  historyPaymentLayout,
  isOnchainHistory,
  onchainMeltOutcome,
  historyReceiptState,
  isPendingLightningMint,
} from '~/features/history/transactionPresentation';
import { isPendingHistory } from '~/features/history/historyList';
import { paymentReceiptStatus } from '~/shared/ui/PaymentStatusIcon';

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', useThemeName: () => 'dark' }));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({ BUISheet: 'Sheet' }));
jest.mock('~/shared/ui/PaymentActionsMenu', () => ({ PaymentActionsMenu: 'PaymentMenu' }));
jest.mock('~/shared/icons', () => ({ RefreshCw: 'RefreshCw' }));
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
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({
  ...jest.requireActual('~/shared/ui/PaymentStatusIcon'),
  PaymentStatusIcon: 'StatusIcon',
}));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));

const address = 'bc1q' + 'a'.repeat(38);
const onchain = { type: 'melt', metadata: { via: 'onchain', address } };
const staleInvoice = 'lnbc1previous-top-up';

it.each(['PAID', 'paid', 'issued', 'completed', 'received'])(
  'shows collected on-chain deposits as completed in both History and receipt (%s)',
  (state) => {
    const entry = { type: 'mint', state, metadata: { via: 'onchain' } };
    expect(isPendingHistory(entry)).toBe(false);
    expect(isPendingLightningMint(entry)).toBe(false);
    expect(paymentReceiptStatus(historyReceiptState(entry))).toBe('success');
  },
);
it('keeps Lightning paid quotes pending while recognizing older on-chain address records', () => {
  const lightning = { type: 'mint', state: 'PAID', paymentRequest: staleInvoice };
  expect(isPendingLightningMint(lightning)).toBe(true);
  expect(isPendingHistory(lightning)).toBe(true);
  expect(paymentReceiptStatus(historyReceiptState(lightning))).toBe('pending');
  const legacy = { ...lightning, paymentRequest: `bitcoin:${address}?amount=0.01` };
  expect(isPendingLightningMint(legacy)).toBe(false);
  expect(paymentReceiptStatus(historyReceiptState(legacy))).toBe('success');
});

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
  expect(tree.root.findAllByType('Row' as any)[0].props.label).toBe('Status');
  expect(row.props.valueColor).toBe('$orange10');
  await act(async () =>
    tree.root
      .findByType('Header' as any)
      .props.headerRight()
      .props.actions.find((action: any) => action.id === 'refresh')
      .onPress(),
  );
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const destination = tree.root.findByProps({ label: 'Destination' });
  expect(destination.props.isCopyable).toBe(true);
  expect(destination.props.copyValue).toBe(address);
  const done = tree.root
    .findAllByType('Button' as any)
    .find((button) => button.props.children === 'Done')!;
  expect(done.props.emphasis).toBe('primary');
  await act(async () => done.props.onPress());
  expect(props.onClose).toHaveBeenCalled();
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
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(address);
  expect(tree.root.findAllByType('Amount' as any)).toHaveLength(0);
});

it('joins rapid status checks and releases the loading action after a network failure', async () => {
  let fail!: (reason: Error) => void;
  const refresh = jest.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  await act(async () => {
    tree = create(<PendingOnchainLayout {...props} direction="withdrawal" onRefresh={refresh} />);
  });
  const check = () =>
    tree.root
      .findAllByType('Button' as any)
      .find((button) => button.props.children === 'Check status')!;
  await act(async () => {
    check().props.onPress();
    check().props.onPress();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(check().props.loading).toBe(true);
  await act(async () => fail(new Error('Offline')));
  expect(check().props.loading).toBe(false);
  expect(check().props.disabled).toBeFalsy();
});
it('moves a known deposit amount into the first details row with no amount above its QR', async () => {
  await act(async () => {
    tree = create(<PendingOnchainLayout {...props} direction="deposit" />);
  });
  const first = tree.root.findByType('Table' as any).children[0] as any;
  expect(first.type).toBe('AmountRow');
  expect(first.props.amount).toBe(250);
  expect(tree.root.findAllByType('Amount' as any)).toHaveLength(0);
});

it('uses a locked loader-only action for an on-chain submission without reporting paid fees', async () => {
  await act(async () => {
    tree = create(
      <OnchainPaymentStatus
        status="processing"
        direction="withdrawal"
        amount={250}
        mint="Example mint"
        address={address}
        feeReserve={10}
        onClose={jest.fn()}
      />,
    );
  });
  expect(tree.root.findByType('Header' as any).props.disabled).toBe(true);
  expect(tree.root.findByType('Button' as any).props).toMatchObject({
    loading: true,
    disabled: true,
  });
  expect(tree.root.findAllByType('StatusIcon' as any)).toHaveLength(0);
  expect(tree.root.findByProps({ label: 'Maximum network fee' }).props.value).toBe('10 sat');
  expect(tree.root.findAllByProps({ label: 'Fee paid' })).toHaveLength(0);
});

it('does not infer blockchain confirmations or actual fees from a successful mint payment', async () => {
  await act(async () => {
    tree = create(
      <OnchainPaymentStatus
        status="success"
        direction="withdrawal"
        amount={250}
        mint="Example mint"
        address={address}
        onClose={jest.fn()}
        technicalDetails={<TextDetails />}
      />,
    );
  });
  expect(tree.root.findByProps({ label: 'Blockchain confirmations' }).props.value).toBe(
    'Not verified',
  );
  expect(tree.root.findByProps({ label: 'Fee paid' }).props.value).toBe('Unavailable');
  expect(tree.root.findByProps({ label: 'Destination' }).props.copyValue).toBe(address);
  expect(tree.root.findAllByType('TechnicalDetails' as any)).toHaveLength(1);
});
function TextDetails() {
  return React.createElement('TechnicalDetails');
}

it('closes an on-chain error without offering an automatic replacement payment', async () => {
  const close = jest.fn();
  await act(async () => {
    tree = create(
      <OnchainPaymentStatus
        status="error"
        direction="withdrawal"
        amount={250}
        mint="Example mint"
        address={address}
        error="Outcome not confirmed"
        onClose={close}
      />,
    );
  });
  expect(tree.root.findByProps({ label: 'Details' }).props.value).toBe('Outcome not confirmed');
  const button = tree.root.findByType('Button' as any);
  expect(button.props.children).toBe('Done');
  await act(async () => button.props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
});
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => false }));
