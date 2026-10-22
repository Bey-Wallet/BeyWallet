import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { ReceiveResultStage } from '~/features/payments/receive/ReceiveResultStage';

jest.mock('tamagui', () => ({
  XStack: 'XStack',
  YStack: 'YStack',
  Text: 'Text',
  Separator: 'Separator',
}));
jest.mock('@tamagui/lucide-icons', () => ({ Copy: 'Copy', ChevronRight: 'ChevronRight' }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'StatusIcon' }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: (state: any) => unknown) => select({ mints: [] }),
}));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatSats: (amount: number) => `${amount} sat` },
}));

let tree: ReactTestRenderer;
async function render(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

it('defaults to compact text, keeps complete dates readable, and copies the original value', async () => {
  const date = 'September 30, 2026 at 23:59:59';
  function Details() {
    return <ListTableRow label="Reclaim eligible" value={date} isCopyable />;
  }
  await render(
    <ListTable>
      <Details />
    </ListTable>,
  );
  const [label, value] = tree.root.findAllByType('Text' as any);
  expect(label.props.fontWeight).toBe('400');
  expect(value.props.fontWeight).toBe('500');
  expect(value.props.fontSize).toBe(14);
  expect(value.props.children).toBe(date);
  expect(value.props.numberOfLines).toBeUndefined();
  expect(value.props.style.maxWidth).toBeUndefined();
  expect(value.props.flexShrink).toBe(1);
  await act(async () => tree.root.findByType('IconButton' as any).props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(date);
});

it('allows an explicit regular-size table while compact remains the default', async () => {
  await render(
    <ListTable compact={false}>
      <ListTableRow label="Setting" value="Value" />
    </ListTable>,
  );
  const [label, value] = tree.root.findAllByType('Text' as any);
  expect(label.props.fontWeight).toBe('400');
  expect(value.props.fontWeight).toBe('500');
  expect(value.props.fontSize).toBe(16);
  expect(value.props.numberOfLines).toBe(1);
});

it('keeps the memo copyable after receiving successfully', async () => {
  await render(
    <ReceiveResultStage status="success" amount="8" note="Lunch ☕" onClose={jest.fn()} />,
  );
  const copy = tree.root.findByType('IconButton' as any);
  await act(async () => copy.props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Lunch ☕');
});

it.each(['secondary', 'primary'] as const)(
  'retains the receipt action handler with %s emphasis',
  async (emphasis) => {
    const onClose = jest.fn();
    await render(
      <PaymentReceipt
        title="Payment"
        amount={10}
        completed
        onClose={onClose}
        {...(emphasis === 'primary' ? { actionLabel: 'Try again', actionEmphasis: emphasis } : {})}
      />,
    );
    const button = tree.root.findByType('Button' as any);
    expect(tree.root.findByType('Header' as any).props.navigationAction).toBe('close');
    expect(button.props.emphasis).toBe(emphasis);
    expect(button.props.variant).toBe(emphasis === 'primary' ? 'branded' : 'default');
    await act(async () => button.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  },
);

it('uses a back arrow when a receipt action returns to editing', async () => {
  const retry = jest.fn();
  await render(
    <PaymentReceipt
      title="Payment not completed"
      amount={10}
      completed={false}
      navigationAction="back"
      onClose={retry}
    />,
  );
  const header = tree.root.findByType('Header' as any);
  expect(header.props.navigationAction).toBe('back');
  header.props.onBack();
  expect(retry).toHaveBeenCalledTimes(1);
});
