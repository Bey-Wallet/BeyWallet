import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { PaymentReceipt } from '~/shared/ui/PaymentReceipt';
import { ReceiveResultStage } from '~/features/payments/receive/ReceiveResultStage';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';

jest.mock('tamagui', () => ({
  XStack: 'XStack',
  YStack: 'YStack',
  Text: 'Text',
  Separator: 'Separator',
  Avatar: 'Avatar',
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Copy: 'Copy',
  ChevronRight: 'ChevronRight',
  RefreshCw: 'RefreshCw',
  ChevronDown: 'ChevronDown',
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Soft: 'soft' },
}));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({
  ...jest.requireActual('~/shared/ui/PaymentStatusIcon'),
  PaymentStatusIcon: 'StatusIcon',
}));
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

it.each(['success', 'pending', 'error', 'cancelled'] as const)(
  'preserves the %s status presentation and uses the matching amount size',
  async (status) => {
    const timestamp = new Date(2026, 9, 24, 20, 33).getTime();
    await render(
      <PaymentReceipt
        title="Payment"
        amount={10}
        completed={status === 'success'}
        status={status}
        statusLabel={status === 'pending' ? 'Awaiting recipient' : undefined}
        onCheckStatus={status === 'pending' ? jest.fn() : undefined}
        mintUrl="https://mint.example"
        time={timestamp}
        onClose={jest.fn()}
      />,
    );
    const rows = tree.root.findAllByType(ListTableRow);
    expect(rows.map((row) => row.props.label)).toEqual(
      status === 'pending' ? ['Status', 'Mint', 'Time'] : ['Mint', 'Time'],
    );
    expect(rows[rows.length - 1].props.value).toBe(formatPaymentDateTime(timestamp));
    expect(tree.root.findByType('Amount' as any).props.size).toBe(
      status === 'pending' ? 'standard' : 'prominent',
    );
    if (status === 'pending') {
      expect(rows[0].props.value).toBe('Awaiting recipient');
      expect(rows[0].props.valueColor).toBe('$orange10');
    }
  },
);
async function render(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}

it('keeps a pending refresh guarded and reports failed checks without claiming success', async () => {
  let fail!: (error: Error) => void;
  const refresh = jest.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  await render(
    <PaymentReceipt
      title="Pending"
      amount={10}
      completed={false}
      status="pending"
      statusLabel="Unresolved"
      onCheckStatus={refresh}
      onClose={jest.fn()}
    />,
  );
  const control = () => tree.root.findByType('IconButton' as any);
  let checking!: Promise<void>;
  await act(async () => {
    checking = control().props.onPress();
    void control().props.onPress();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(control().props.loading).toBe(true);
  await act(async () => {
    fail(new Error('Offline'));
    await checking;
  });
  expect(tree.root.findByType(PaymentStatusRow).findByType(ListTableRow).props).toMatchObject({
    value: 'Unverified',
    valueColor: '$gray10',
  });
  expect(control().props.loading).toBe(false);
});
it('exposes selected choices and prevents disabled selection', async () => {
  const select = jest.fn();
  await render(<ListTableRow label="1 block" value="12 sat" selected disabled onPress={select} />);
  const row = tree.root
    .findAllByType('YStack' as any)
    .find((item) => item.props.accessibilityRole === 'button')!;
  expect(row.props.accessibilityState).toEqual({ disabled: true, selected: true });
  expect(row.props.onPress).toBeUndefined();
  expect(select).not.toHaveBeenCalled();
});

it('shares compact mint and balance rows while keeping selector and maximum actions separate', async () => {
  const select = jest.fn();
  const max = jest.fn();
  await render(
    <MintBalanceRow
      displayName="Sample mint"
      balance={21}
      onPress={select}
      showMax
      onMaxPress={max}
    />,
  );
  const rows = tree.root.findAllByType(ListTableRow);
  expect(rows.map((row) => row.props.label)).toEqual(['Mint', 'Available balance']);
  expect(rows[1].props.value).toBe('21 sat');
  await act(async () => rows[0].props.onPress());
  expect(select).toHaveBeenCalledTimes(1);
  expect(max).not.toHaveBeenCalled();
  const button = tree.root.findByType('Button' as any);
  await act(async () => button.props.onPress());
  expect(max).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(1);
});

it('keeps read-only mint selectors and empty-balance maximum actions disabled', async () => {
  await render(<MintBalanceRow balance={0} isSelector={false} showMax onMaxPress={jest.fn()} />);
  expect(tree.root.findAllByType(ListTableRow)[0].props.onPress).toBeUndefined();
  expect(tree.root.findByType('Button' as any).props.disabled).toBe(true);
});

it('renders row-owned dividers through fragments, nested helpers, and conditional updates', async () => {
  function ExtraRows({ show }: { show: boolean }) {
    return (
      <>
        {show && <ListTableRow label="Network fee" value="1 sat" />}
        <ListTableRow label="Transaction hash" value="Sample hash" />
      </>
    );
  }
  function Fixture({ show }: { show: boolean }) {
    return (
      <ListTable>
        <ListTableRow label="Date" value="Today" />
        <>
          <ListTableRow label="Mint" value="Sample mint" />
          <ListTableRow label="Channel" value="On-chain" />
        </>
        <ExtraRows show={show} />
      </ListTable>
    );
  }
  await render(<Fixture show />);
  const dividers = () => tree.root.findAllByProps({ testID: 'list-table-divider' });
  expect(dividers()).toHaveLength(5);
  for (const divider of dividers()) {
    expect(divider.props).toMatchObject({ height: 2, width: '100%', accessible: false });
  }
  const rowGroup = tree.root.findByProps({ testID: 'list-table-rows' });
  expect(
    rowGroup.props.mt ??
      rowGroup.props.marginTop ??
      StyleSheet.flatten(rowGroup.props.style)?.marginTop,
  ).toBe(-2);
  expect(tree.root.findAllByType('YStack' as any).some((node) => node.props.separator)).toBe(false);
  await act(async () => tree.update(<Fixture show={false} />));
  expect(dividers()).toHaveLength(4);
});

it.each(['filled', 'outlined'] as const)(
  'keeps %s table borders and row dividers consistent',
  async (variant) => {
    await render(
      <ListTable variant={variant} testID="table-variant">
        <ListTableRow label="Mint" value="Sample" />
        <>
          <ListTableRow label="Fee" value="1 sat" />
        </>
      </ListTable>,
    );
    const table = tree.root
      .findAllByProps({ testID: 'table-variant' })
      .find((node) => node.type !== ListTable)!;
    const styles = StyleSheet.flatten(table.props.style) ?? {};
    expect(table.props.bg ?? table.props.backgroundColor ?? styles.backgroundColor).toBe(
      variant === 'outlined' ? 'transparent' : '$gray2',
    );
    expect(table.props.borderWidth ?? styles.borderWidth).toBe(variant === 'outlined' ? 2 : 0);
    for (const divider of tree.root.findAllByProps({ testID: 'list-table-divider' })) {
      expect(divider.props.bg ?? divider.props.backgroundColor).toBe(
        variant === 'outlined' ? '$borderColor' : '$background',
      );
    }
  },
);

it('keeps shared receipts filled by default', async () => {
  await render(
    <PaymentReceipt
      title="Payment"
      amount={10}
      completed
      mintUrl="https://sample.mint"
      onClose={jest.fn()}
    />,
  );
  const divider = tree.root.findByProps({ testID: 'list-table-divider' });
  expect(divider.props.bg ?? divider.props.backgroundColor).toBe('$background');
});

it('does not add table dividers to standalone rows', async () => {
  await render(<ListTableRow label="Standalone" value="Value" />);
  expect(tree.root.findAllByProps({ testID: 'list-table-divider' })).toHaveLength(0);
});

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
    expect(button.props.variant).toBe('default');
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
