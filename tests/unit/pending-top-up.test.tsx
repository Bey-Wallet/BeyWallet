import React from 'react';
jest.mock('~/shared/ui/PaymentAmountRow', () => ({ PaymentAmountRow: 'AmountRow' }));
jest.mock('~/features/history/components/ReceiptImageShare', () => ({
  ReceiptImageShare: 'ReceiptShare',
}));
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PendingMintInvoiceLayout } from '~/features/history/components/PendingMintInvoiceLayout';
import { PaymentStage } from '~/features/payments/mint/PaymentStage';

let mockAutomaticCheck: () => Promise<void> | void;
let mockListeningEnabled = false;
const mockFeedback = jest.fn();
const mockRemoteQuote = jest.fn();
jest.mock('~/services/wallet', () => ({
  quotesService: { checkMintQuote: (...args: unknown[]) => mockRemoteQuote(...args) },
}));
jest.mock('~/shared/hooks/usePendingPaymentPolling', () => ({
  usePendingPaymentPolling: (check: () => Promise<void> | void, enabled: boolean) => {
    mockAutomaticCheck = check;
    mockListeningEnabled = enabled;
  },
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => false }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ mints: [] }),
}));

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', useThemeName: () => 'dark' }));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({ BUISheet: 'Sheet' }));
jest.mock('~/shared/ui/PaymentActionsMenu', () => ({ PaymentActionsMenu: 'PaymentMenu' }));
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
  useAppToast: () => ({ showFeedback: mockFeedback }),
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
beforeEach(() => {
  jest.clearAllMocks();
  mockRemoteQuote.mockResolvedValue({ state: 'PAID' });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('shows a paid top-up as awaiting ecash, removes its QR and cancel action, and offers collection', async () => {
  await act(async () => {
    tree = create(<PendingMintInvoiceLayout {...props} />);
  });
  expect(tree.root.findAllByType('QR' as any)).toHaveLength(0);
  expect(tree.root.findByType('Status' as any).props.value).toBe('Awaiting ecash');
  expect((tree.root.findByType('Table' as any).children[0] as any).type).toBe('AmountRow');
  const buttons = tree.root.findAllByType('Button' as any);
  expect(buttons.map((button) => button.props.children)).toEqual(['Copy']);
  expect(props.onPaid).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findByType('Header' as any)
      .props.headerRight()
      .props.actions.find((action: any) => action.id === 'refresh')
      .onPress(),
  );
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
    'Copy',
  ]);
});

it('puts live Lightning receipt sharing in the header instead of the action area', async () => {
  await act(async () => {
    tree = create(
      <PaymentStage
        amount="64"
        invoice="lnbc123synthetic"
        quoteId="quote"
        mintUrl="https://mint.example"
        onPaid={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
  });
  const header = tree.root.findByType('Header' as any);
  const menu = header.props.headerRight();
  expect(header.props.title.split(/\s+/).length).toBeLessThanOrEqual(2);
  expect(menu.props.actions.some((action: any) => action.id === 'receipt-image')).toBe(true);
  expect(tree.root.findByType('ReceiptShare' as any).props.hideTrigger).toBe(true);
});

it.each([true, false])('blocks collection while offline=%s or busy', async (offline) => {
  await act(async () => {
    tree = create(
      <PendingMintInvoiceLayout {...props} offline={offline} isCheckingPaid={!offline} />,
    );
  });
  const menu = tree.root.findByType('Header' as any).props.headerRight();
  expect(menu.props.actions.find((action: any) => action.id === 'refresh').disabled).toBe(offline);
  expect(menu.props.busy).toBe(!offline);
  expect(props.onPaid).not.toHaveBeenCalled();
});

it('checks a live invoice silently and prevents a simultaneous manual redemption', async () => {
  let finish!: () => void;
  const onPaid = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    tree = create(
      <PaymentStage
        amount="64"
        invoice="lnbc-test"
        quoteId="quote"
        mintUrl="mint"
        onPaid={onPaid}
        onCancel={jest.fn()}
      />,
    );
  });
  expect(mockListeningEnabled).toBe(true);
  let checking!: Promise<void>;
  await act(async () => {
    checking = Promise.resolve(mockAutomaticCheck());
    tree.root
      .findByType('Header' as any)
      .props.headerRight()
      .props.actions.find((action: any) => action.id === 'refresh')
      .onPress();
  });
  expect(onPaid).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await checking;
  });
  expect(mockFeedback).not.toHaveBeenCalled();
});

it('keeps unpaid background checks silent and stops checking expired invoices', async () => {
  mockRemoteQuote.mockResolvedValue({ state: 'UNPAID' });
  const onPaid = jest.fn();
  const stage = (expiry?: number) => (
    <PaymentStage
      amount="64"
      invoice="lnbc-test"
      quoteId="quote"
      mintUrl="mint"
      expiry={expiry}
      onPaid={onPaid}
      onCancel={jest.fn()}
    />
  );
  await act(async () => {
    tree = create(stage());
  });
  await act(async () => {
    await mockAutomaticCheck();
  });
  expect(onPaid).not.toHaveBeenCalled();
  expect(mockFeedback).not.toHaveBeenCalled();
  await act(async () => tree.update(stage(1)));
  expect(mockListeningEnabled).toBe(false);
  await act(async () => {
    await mockAutomaticCheck();
  });
  expect(onPaid).not.toHaveBeenCalled();
});

it('stops all invoice checks once POS marks the sale complete', async () => {
  await act(async () => {
    tree = create(
      <PaymentStage
        amount="64"
        invoice="lnbc-test"
        quoteId="quote"
        mintUrl="mint"
        onPaid={jest.fn()}
        onCancel={jest.fn()}
        listening={false}
      />,
    );
  });
  expect(mockListeningEnabled).toBe(false);
  await act(async () => {
    await mockAutomaticCheck();
  });
  expect(mockRemoteQuote).not.toHaveBeenCalled();
});
