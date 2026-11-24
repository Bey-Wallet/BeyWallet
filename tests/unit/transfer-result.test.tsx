import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ResultStage } from '~/features/payments/swap/ResultStage';

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
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
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/features/payments/swap/TransferTechnicalDetails', () => ({
  TransferTechnicalDetails: 'TechnicalDetails',
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => false }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (n: number) => String(n) },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) =>
    selector({
      mints: [
        { mintUrl: 'https://source.example', name: 'Source' },
        { mintUrl: 'https://target.example', nickname: 'Destination' },
      ],
    }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const props = {
  amount: '100',
  sourceMintUrl: 'https://source.example',
  targetMintUrl: 'https://target.example',
  error: null,
  onClose: jest.fn(),
};

it.each([
  ['pending', 'Transfer pending', false],
  ['success', 'Transfer completed', true],
  ['error', 'Transfer not completed', false],
] as const)('shows the correct receipt for %s', async (status, title, _completed) => {
  await act(async () => {
    tree = create(<ResultStage {...props} status={status} />);
  });
  expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe(title);
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe(status);
  expect(
    tree.root.findAllByType('Button' as any).find((button) => button.props.children === 'Done')!
      .props.emphasis,
  ).toBe('primary');
  expect(tree.root.findByProps({ label: 'From mint' }).props.value).toBe('Source');
  expect(tree.root.findByProps({ label: 'To mint' }).props.value).toBe('Destination');
});

it('distinguishes delayed issuance from a failed transfer and retains its timestamp', async () => {
  const record = { stage: 'issuance', createdAt: 123, feePaid: null, feeReserve: 3 } as any;
  await act(async () => {
    tree = create(<ResultStage {...props} status="pending" record={record} />);
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe(
    'Waiting for destination ecash',
  );
  expect(tree.root.findByType('TechnicalDetails' as any).props.record.createdAt).toBe(123);
  expect(tree.root.findByProps({ label: 'Maximum fee' }).props.value).toBe('3');
});

it('shows conflicting mint evidence as needing review rather than a failed payment', async () => {
  const record = { stage: 'settlement', createdAt: 123, feePaid: null, feeReserve: 3 } as any;
  await act(async () => {
    tree = create(<ResultStage {...props} status="pending" record={record} />);
  });
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
  expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe(
    'Transfer needs review',
  );
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Checking transfer outcome');
  expect(
    tree.root
      .findAllByType('Button' as any)
      .some((button) => button.props.children === 'Try again'),
  ).toBe(false);
});

it('retains pending payment status when its status check fails and offers verification guidance', async () => {
  const check = jest.fn();
  await act(async () => {
    tree = create(
      <ResultStage {...props} status="pending" statusCheckFailed onCheckStatus={check} />,
    );
  });
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
  expect(String(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children)).toContain(
    'Could not verify this transfer',
  );
  await act(async () =>
    tree.root
      .findAllByType('Button' as any)
      .find((button) => button.props.children === 'Check status')!
      .props.onPress(),
  );
  expect(check).toHaveBeenCalledTimes(1);
});

it.each([null, 0, 2])(
  'keeps actual completion fees separate from the reserve (%s)',
  async (feePaid) => {
    const record = {
      state: 'completed',
      stage: 'issuance',
      amount: 100,
      feePaid,
      feeReserve: 9,
    } as any;
    await act(async () => {
      tree = create(<ResultStage {...props} status="success" record={record} />);
    });
    expect(tree.root.findByProps({ label: 'Fee paid' }).props.value).toBe(
      feePaid == null ? 'Unavailable' : String(feePaid),
    );
    expect(tree.root.findByProps({ label: 'Total' }).props.value).toBe(
      feePaid == null ? 'Unavailable' : String(100 + feePaid),
    );
    expect(tree.root.findAllByProps({ label: 'Maximum fee' })).toHaveLength(0);
  },
);

it('prevents overlapping checks and leaves the transfer pending after a failed check', async () => {
  let fail!: (reason: Error) => void;
  const check = jest.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  await act(async () => {
    tree = create(
      <ResultStage {...props} status="pending" onCheckStatus={check} onRetry={jest.fn()} />,
    );
  });
  const button = () =>
    tree.root
      .findAllByType('Button' as any)
      .find((item) => item.props.children === 'Check status')!;
  await act(async () => {
    button().props.onPress();
    button().props.onPress();
  });
  expect(check).toHaveBeenCalledTimes(1);
  expect(button().props.loading).toBe(true);
  await act(async () => fail(new Error('Network unavailable')));
  expect(button().props.loading).toBe(false);
  expect(tree.root.findByType('StatusIcon' as any).props.status).toBe('pending');
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'Could not verify',
  );
  expect(
    tree.root.findAllByType('Button' as any).some((item) => item.props.children === 'Try again'),
  ).toBe(false);
});
