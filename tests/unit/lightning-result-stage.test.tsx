import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MeltResultStage } from '~/features/payments/melt/ResultStage';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ mints: [{ mintUrl: 'https://mint', name: 'Mint' }] }),
}));
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
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (amount: number) => `${amount} sat` },
}));
jest.mock('~/features/payments/useLightningReceipt', () => ({
  useLightningReceipt: () => ({ rows: null, extraDetails: <div>Technical details</div> }),
}));

let tree: ReactTestRenderer;
const props = { amount: 20, feeReserve: 5, mintUrl: 'https://mint', onClose: jest.fn() };
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

it('locks processing controls and puts loading in the bottom button without a top spinner', async () => {
  await act(async () => {
    tree = create(<MeltResultStage {...props} status="processing" />);
  });
  expect(tree.root.findByType('Header' as any).props.disabled).toBe(true);
  expect(tree.root.findByType('Header' as any).props.title).toBe('Processing payment');
  const button = tree.root.findByProps({ children: 'Processing' });
  expect(button.props).toMatchObject({
    disabled: true,
    fullWidth: true,
    emphasis: 'primary',
    accessibilityState: { busy: true, disabled: true },
  });
  expect(button.props.loadingText).toBe('Processing');
  expect(button.props.loading).toBe(true);
  expect(tree.root.findAllByProps({ accessibilityRole: 'header' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Status' })).toHaveLength(0);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('StatusIcon' as any)).toHaveLength(0);
  expect(tree.root.findAllByProps({ children: 'View History' })).toHaveLength(0);
});

it.each(['pending', 'unresolved'] as const)(
  'checks the %s payment without offering History or another payment',
  async (status) => {
    const refresh = jest.fn(async () => {});
    await act(async () => {
      tree = create(<MeltResultStage {...props} status={status} onRefresh={refresh} />);
    });
    expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
    expect(tree.root.findByProps({ children: 'Check status' }).props).toMatchObject({
      size: 'small',
      fullWidth: false,
    });
    expect(tree.root.findByProps({ children: 'Done' }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ children: 'Done' }).props.icon).toBeUndefined();
    await act(async () => tree.root.findByProps({ children: 'Check status' }).props.onPress());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ children: 'View History' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: 'Retry payment' })).toHaveLength(0);
  },
);

it('never presents a fee reserve as an actual fee and keeps the amount size stable', async () => {
  await act(async () => {
    tree = create(<MeltResultStage {...props} status="pending" />);
  });
  const amountSize = tree.root.findByType('Amount' as any).props.size;
  await act(async () => tree.update(<MeltResultStage {...props} status="success" />));
  expect(tree.root.findByType('Amount' as any).props.size).toBe(amountSize);
  expect(tree.root.findByProps({ label: 'Fee paid' }).props.value).toBe('Unavailable');
  expect(tree.root.findAllByProps({ label: 'Maximum fee' })).toHaveLength(0);
  await act(async () => tree.update(<MeltResultStage {...props} status="success" feeSats={0} />));
  expect(tree.root.findByProps({ label: 'Fee paid' }).props.value).toBe('0 sat');
});

it('keeps a failed status check unconfirmed and offers another check', async () => {
  const refresh = jest.fn().mockRejectedValue(new Error('offline'));
  await act(async () => {
    tree = create(<MeltResultStage {...props} status="unresolved" onRefresh={refresh} />);
  });
  await act(async () => tree.root.findByProps({ children: 'Check status' }).props.onPress());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'still unconfirmed',
  );
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
});
