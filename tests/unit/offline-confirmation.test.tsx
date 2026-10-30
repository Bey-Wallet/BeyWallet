import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConfirmStage } from '~/features/payments/send/ConfirmStage';
import { OFFLINE_CHANGE_REQUIRED } from '~/shared/utils/offlineSendUtils';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
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
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AmountOption' }));
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'Mint' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/ReclaimSelector', () => ({ ReclaimSelector: 'Reclaim' }));
jest.mock('~/shared/ui/PaymentNote', () => ({ PaymentNote: 'Note' }));
jest.mock('~/shared/ui/FirstUseGuidance', () => ({ FirstUseGuidance: 'Guidance' }));
jest.mock('~/features/payments/send/P2PKLockCard', () => ({ P2PKLockCard: 'Lock' }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (amount: number) => `₿${amount}` },
}));

const props = {
  amount: '20',
  mintUrl: 'mint-a',
  estimatedFee: null,
  sendMode: 'standard' as const,
  useP2PK: false,
  setUseP2PK: jest.fn(),
  reclaimSupported: false,
  reclaimHours: 0,
  setReclaimHours: jest.fn(),
  ready: false,
  isOffline: true,
  onConfirm: jest.fn(),
  onBack: jest.fn(),
  onMintChange: jest.fn(),
  onAmountSelect: jest.fn(),
  onPrepareChange: jest.fn(),
  error: OFFLINE_CHANGE_REQUIRED,
};
let tree: ReactTestRenderer;
const buttons = () => tree.root.findAllByType('Button' as any);
const options = () => tree.root.findAllByType('AmountOption' as any);
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('offers both nearest amounts without enabling creation or sending on selection', async () => {
  await act(async () => {
    tree = create(
      <ConfirmStage {...props} offlineAmounts={{ exact: false, lower: 16, higher: 32 }} />,
    );
  });
  expect(buttons().map((button) => button.props.children)).toEqual([
    'Prepare change',
    'Create ecash',
  ]);
  expect(options().map((option) => option.props.accessibilityLabel)).toEqual([
    'Lower: ₿16',
    'Higher: ₿32',
  ]);
  expect(buttons().at(-1)!.props.disabled).toBe(true);
  await act(async () => options()[0].props.onPress());
  expect(props.onAmountSelect).toHaveBeenCalledWith(16);
  expect(props.onConfirm).not.toHaveBeenCalled();
  expect(tree.root.findByType('Amount' as any).props.amount).toBe(20);
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === OFFLINE_CHANGE_REQUIRED),
  ).toBe(false);
});

it('omits a missing side and disables every action during creation', async () => {
  await act(async () => {
    tree = create(
      <ConfirmStage
        {...props}
        isLoading
        offlineAmounts={{ exact: false, lower: null, higher: 32 }}
      />,
    );
  });
  expect(buttons().map((button) => button.props.children)).toEqual([
    'Prepare change',
    'Create ecash',
  ]);
  expect(options().map((option) => option.props.accessibilityLabel)).toEqual(['Higher: ₿32']);
  expect(options().every((option) => option.props.disabled)).toBe(true);
  expect(buttons().every((button) => button.props.disabled)).toBe(true);
});

it('shows exact offline readiness without replacement actions', async () => {
  await act(async () => {
    tree = create(
      <ConfirmStage
        {...props}
        error={null}
        ready
        estimatedFee={0}
        offlineAmounts={{ exact: true, lower: null, higher: null }}
      />,
    );
  });
  expect(buttons().map((button) => button.props.children)).toEqual(['Create ecash']);
  expect(buttons()[0].props.disabled).toBe(false);
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'Available offline'),
  ).toBe(true);
});

it('hides offline choices immediately on reconnect, even before the previous check clears', async () => {
  await act(async () => {
    tree = create(
      <ConfirmStage
        {...props}
        isOffline={false}
        error={null}
        offlineAmounts={{ exact: false, lower: 16, higher: 32 }}
      />,
    );
  });
  expect(options()).toHaveLength(0);
  expect(buttons().map((button) => button.props.children)).toEqual(['Create ecash']);
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'Exact amount needs online change'),
  ).toBe(false);
});
