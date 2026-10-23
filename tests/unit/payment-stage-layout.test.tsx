import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import {
  PaymentStatusIcon,
  paymentReceiptStatus,
  paymentStatusColors,
} from '~/shared/ui/PaymentStatusIcon';

const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  ScrollView: 'ScrollView',
  Text: 'Text',
  useTheme: () => ({ background: { val: '#000' }, color: { val: '#fff' } }),
}));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('@tamagui/lucide-icons', () => ({
  ChevronLeft: 'ChevronLeft',
  Check: 'Check',
  X: 'X',
  Clock: 'Clock',
  Minus: 'Minus',
}));
jest.mock('expo-router', () => ({ Stack: { Screen: 'StackScreen' }, useRouter: () => mockRouter }));

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

it.each(['confirm', 'qr', 'receipt'] as const)(
  'keeps %s content and its footer equally inset with the action outside scrolling',
  async (variant) => {
    const tree = await render(
      <PaymentStageLayout variant={variant} hero="Amount or QR" footer="Primary action">
        Details
      </PaymentStageLayout>,
    );
    expect(tree.root.findByProps({ testID: 'payment-stage-layout' }).props.px).toBe('$4');
    const scroll = tree.root.findByType('ScrollView' as any);
    expect(scroll.props.contentContainerStyle.flexGrow).toBe(1);
    expect(scroll.findAllByProps({ testID: 'payment-stage-footer' })).toHaveLength(0);
    const hero = tree.root.findByProps({ testID: 'payment-stage-hero' });
    expect(hero.props.flex).toBe(variant === 'qr' ? undefined : 1);
    expect(tree.root.findByProps({ testID: 'payment-stage-details' }).props.width).toBe('100%');
    await act(async () => tree.unmount());
  },
);

it('matches the mint QR frame with a 280px cap and 20px quiet margin on each side', async () => {
  let size = 0;
  const tree = await render(
    <PaymentQRFrame accessibilityLabel="Request QR">
      {(value) => {
        size = value;
        return 'QR';
      }}
    </PaymentQRFrame>,
  );
  const frame = tree.root.findByType('YStack' as any);
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 260 } } }));
  expect(size).toBe(220);
  const surface = tree.root.findByProps({ testID: 'payment-qr-surface' });
  const style = StyleSheet.flatten(surface.props.style) || {};
  expect(surface.props.p ?? style.padding ?? style.paddingLeft).toBe(20);
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 600 } } }));
  expect(size).toBe(280);
  await act(async () => tree.unmount());
});

it('configures a disabled stack chevron with the local stage back action', async () => {
  const onBack = jest.fn();
  const tree = await render(<PaymentFlowHeader title="Confirm request" onBack={onBack} disabled />);
  const options = tree.root.findByType('StackScreen' as any).props.options;
  expect(options.title).toBe('Confirm request');
  const titleTree = await render(options.headerTitle({ children: options.title }));
  const title = titleTree.root.findByType('Text' as any);
  expect(title.props.children).toBe('Confirm request');
  expect(title.props.fontFamily).toBe('$body');
  expect(title.props.fontWeight).toBe('600');
  await act(async () => titleTree.unmount());
  expect(options.headerBackVisible).toBe(false);
  const button = options.headerLeft();
  expect(button.props.disabled).toBe(true);
  expect(button.props.accessibilityLabel).toBe('Back');
  // The button component enforces disabled; the configured action is the local stage back.
  button.props.onPress();
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(mockRouter.back).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it.each([
  ['paid', false, 'success'],
  ['ISSUED', false, 'success'],
  [' issued ', false, 'success'],
  ['COMPLETED', false, 'success'],
  ['claimed', false, 'success'],
  ['finalized', false, 'success'],
  ['FINALIZED', false, 'success'],
  ['failed', false, 'error'],
  ['ERROR', false, 'error'],
  ['pending', false, 'pending'],
  ['paid', true, 'pending'],
  ['expired', false, 'cancelled'],
  ['refunded', false, 'success'],
] as const)(
  'gives %s receipts the same status icon and color as transaction details',
  async (state, broadcast, expected) => {
    const status = paymentReceiptStatus(state, broadcast);
    expect(status).toBe(expected);
    const tree = await render(<PaymentStatusIcon status={status} />);
    const icon = tree.root.findByProps({ testID: `payment-status-${expected}` });
    expect(icon.props.bg).toBe(paymentStatusColors[expected]);
    expect(icon.props.width).toBe(60);
    expect(
      tree.root.findByType(
        ({ success: 'Check', error: 'X', pending: 'Clock', cancelled: 'Minus' } as const)[
          expected
        ] as any,
      ).props.color,
    ).toBe('white');
    await act(async () => tree.unmount());
  },
);

it('updates both the receipt icon and its background when a mint finishes issuing', async () => {
  const tree = await render(<PaymentStatusIcon status={paymentReceiptStatus('UNPAID')} />);
  expect(tree.root.findByProps({ testID: 'payment-status-pending' }).props.bg).toBe('$orange10');
  expect(tree.root.findByType('Clock' as any)).toBeTruthy();
  await act(async () => {
    tree.update(<PaymentStatusIcon status={paymentReceiptStatus('ISSUED')} />);
  });
  expect(tree.root.findByProps({ testID: 'payment-status-success' }).props.bg).toBe('$green10');
  expect(tree.root.findByType('Check' as any).props.color).toBe('white');
  expect(tree.root.findAllByType('Clock' as any)).toHaveLength(0);
  await act(async () => tree.unmount());
});
