import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentInfoHeader } from '~/shared/ui/PaymentInfoHeader';
import { infoSheetContent } from '~/shared/components/info-sheets/infoSheetContent';
import { ReceiptSheetContext } from '~/shared/ui/ReceiptSheetContext';

const mockPresent = jest.fn();
const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: mockSetOptions };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({
  PaymentFlowHeader: (props: any) =>
    require('react').createElement('PaymentHeader', props, props.headerRight?.()),
}));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'InfoButton' }));
jest.mock('@tamagui/lucide-icons', () => ({ CircleHelp: 'HelpIcon' }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({
  BUISheet: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ present: mockPresent }));
    return require('react').createElement('InformationSheet', props, props.children);
  }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  mockPresent.mockClear();
  mockSetOptions.mockClear();
});
it('opens read-only information through an empty header slot without invoking navigation', async () => {
  const onBack = jest.fn();
  await act(async () => {
    tree = create(<PaymentInfoHeader title="Send" infoTopic="ecash-send" onBack={onBack} />);
  });
  expect(mockPresent).not.toHaveBeenCalled();
  expect(tree.root.findByType('InfoButton' as any).props).toMatchObject({
    emphasis: 'secondary',
    size: 'xxsmall',
    iconSize: 22,
    icon: 'HelpIcon',
  });
  tree.root.findByType('InfoButton' as any).props.onPress();
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(tree.root.findByType('InformationSheet' as any).props).toMatchObject({
    title: 'Send ecash',
    headerVariant: 'modal',
  });
});
it.each([false, true])(
  'preserves an existing header action, even one returning null (%s)',
  async (empty) => {
    const headerRight = jest.fn(() => (empty ? null : React.createElement('ExistingAction')));
    await act(async () => {
      tree = create(
        <PaymentInfoHeader title="Send" infoTopic="ecash-send" headerRight={headerRight} />,
      );
    });
    expect(tree.root.findByType('PaymentHeader' as any).props.headerRight).toBe(headerRight);
    expect(tree.root.findAllByType('InfoButton' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('InformationSheet' as any)).toHaveLength(0);
  },
);
it('keeps operation controls disabled while busy', async () => {
  await act(async () => {
    tree = create(<PaymentInfoHeader title="Confirm" infoTopic="lightning-pay" disabled />);
  });
  expect(tree.root.findByType('InfoButton' as any).props.disabled).toBe(true);
  expect(tree.root.findByType('InformationSheet' as any).props.canDismiss).toBe(false);
});
it('does not add another action when the receipt sheet already owns the header', async () => {
  await act(async () => {
    tree = create(
      <ReceiptSheetContext.Provider value={{ close: jest.fn(), hasSheetHeader: true }}>
        <PaymentInfoHeader title="Receive" infoTopic="ecash-receive" />
      </ReceiptSheetContext.Provider>,
    );
  });
  expect(tree.root.findAllByType('InfoButton' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('InformationSheet' as any)).toHaveLength(0);
});
it('clears its Info action when the entry stage unmounts, so a pending receipt cannot inherit it', async () => {
  await act(async () => {
    tree = create(<PaymentInfoHeader title="Send" infoTopic="ecash-send" />);
  });
  await act(async () => tree.unmount());
  expect(mockSetOptions).toHaveBeenCalledWith({ headerRight: undefined });
});
it('retains the important verification and backup limitations', () => {
  expect(infoSheetContent['verify-proofs'].paragraphs.join(' ')).toContain(
    'does not establish whether a proof is still unspent',
  );
  expect(infoSheetContent['lightning-request'].paragraphs.join(' ')).toContain(
    'does not mean you have been paid',
  );
  expect(infoSheetContent['mint-backup'].paragraphs.join(' ')).toContain(
    'not a full wallet backup',
  );
  expect(infoSheetContent['restore-backup'].paragraphs.join(' ')).toContain(
    'replaces the wallet data',
  );
});
