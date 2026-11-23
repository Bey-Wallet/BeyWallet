import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConfirmStage } from '~/features/payments/send/ConfirmStage';
import { EcashPaymentStatus } from '~/features/payments/send/EcashPaymentStatus';

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', XStack: 'XStack' }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ mints: [{ mintUrl: 'mint-a', nickname: 'Mint A' }] }),
}));
jest.mock('~/shared/ui/PaymentInfoHeader', () => ({ PaymentInfoHeader: 'Header' }));
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
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'Mint' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/ReclaimSelector', () => ({ ReclaimSelector: 'Reclaim' }));
jest.mock('~/shared/ui/PaymentNote', () => ({ PaymentNote: 'Note' }));
jest.mock('~/features/payments/send/P2PKLockCard', () => ({ P2PKLockCard: 'Lock' }));
jest.mock('~/features/history/components/ReceiptExtraDetails', () => ({
  ReceiptExtraDetails: 'TechnicalDetails',
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: 'wallet' }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (amount: number) => `${amount} sat` },
}));

const props = {
  amount: '20',
  mintUrl: 'mint-a',
  estimatedFee: 2,
  sendMode: 'standard' as const,
  useP2PK: false,
  setUseP2PK: jest.fn(),
  reclaimSupported: false,
  reclaimHours: 0,
  setReclaimHours: jest.fn(),
  ready: true,
  onConfirm: jest.fn(),
  onBack: jest.fn(),
  onMintChange: jest.fn(),
};
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

it('shows the creation fee and total with an amount-labelled confirmation button', async () => {
  await act(async () => {
    tree = create(<ConfirmStage {...props} />);
  });
  expect(tree.root.findByProps({ label: 'Creation fee' }).props.value).toBe('2 sat');
  expect(tree.root.findByProps({ label: 'Total' }).props.value.props.children).toBe('22 sat');
  expect(tree.root.findByProps({ children: 'Create 20 sat' }).props.disabled).toBe(false);
  expect(tree.root.findByType('Amount' as any).props.compact).toBe(true);
});

it('keeps unknown fees and totals unknown', async () => {
  await act(async () => {
    tree = create(<ConfirmStage {...props} ready={false} estimatedFee={null} />);
  });
  expect(tree.root.findByProps({ label: 'Creation fee' }).props.value).toBe('Calculating…');
  expect(tree.root.findByProps({ label: 'Total' }).props.value.props.children).toBe('Calculating…');
  expect(tree.root.findByProps({ children: 'Create 20 sat' }).props.disabled).toBe(true);
});

it.each(['standard', 'p2pk', 'nostr'] as const)(
  'uses the locked processing layout for %s',
  async (sendMode) => {
    await act(async () => {
      tree = create(<ConfirmStage {...props} sendMode={sendMode} isLoading />);
    });
    expect(tree.root.findByType('Header' as any).props.title).toBe('Processing payment');
    const button = tree.root.findByProps({ children: 'Processing' });
    expect(button.props.disabled).toBe(true);
    expect(button.props.icon.type).toBe('Spinner');
    expect(tree.root.findAllByType('StatusIcon' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('Mint' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('Lock' as any)).toHaveLength(0);
    expect(props.onConfirm).not.toHaveBeenCalled();
  },
);

it('shows a failed result without inventing a paid fee and keeps references in a sheet', async () => {
  await act(async () => {
    tree = create(
      <EcashPaymentStatus
        status="error"
        amount={20}
        mintUrl="mint-a"
        operationId="operation-id"
        onClose={props.onBack}
      />,
    );
  });
  expect(tree.root.findByProps({ label: 'Creation fee' }).props.value).toBe('Unavailable');
  expect(tree.root.findAllByProps({ label: 'Fee paid' })).toHaveLength(0);
  expect(tree.root.findByType('TechnicalDetails' as any).props).toMatchObject({
    presentation: 'sheet',
    fields: expect.arrayContaining([
      expect.objectContaining({
        section: 'Transaction',
        label: 'Operation ID',
        copyValue: 'operation-id',
      }),
    ]),
  });
  await act(async () => tree.root.findByProps({ children: 'Done' }).props.onPress());
  expect(props.onBack).toHaveBeenCalledTimes(1);
});
