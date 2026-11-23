import React from 'react';
import { Share } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockCopy = jest.fn(async (..._args: unknown[]) => true);
const mockFeedback = jest.fn();
jest.mock('~/shared/utils/copyWithFeedback', () => ({
  copyWithFeedback: (...args: unknown[]) => mockCopy(...args),
}));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ showFeedback: mockFeedback }),
}));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({
  BUISheet: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));
jest.mock('tamagui', () => ({ YStack: 'YStack', XStack: 'XStack', Text: 'Text' }));
jest.mock('~/shared/icons', () => ({
  ChevronDown: 'Down',
  ChevronUp: 'Up',
  Copy: 'Copy',
  Share2: 'Share',
}));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it('opens technical references in a separate sheet and returns to the receipt on Back', async () => {
  await act(async () => {
    tree = create(
      <ReceiptExtraDetails
        presentation="sheet"
        fields={[{ label: 'Invoice', value: 'short', copyValue: 'complete invoice' }]}
      />,
    );
  });
  const trigger = () => tree.root.findByProps({ children: 'Technical details' });
  await act(async () => trigger().props.onPress());
  expect(mockPresent).toHaveBeenCalledTimes(1);
  const sheet = tree.root.findByType('Sheet' as any);
  expect(sheet.props.title).toBe('Technical details');
  expect(sheet.props.navigation).toBe('back');
  expect(tree.root.findByType('Row' as any).props.copyValue).toBe('complete invoice');
  await act(async () => sheet.props.onBack());
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  await act(async () => sheet.props.onClose());
  expect(trigger().props.accessibilityState.expanded).toBe(false);
});

it('copies all technical details from the bottom button using complete values', async () => {
  await act(async () => {
    tree = create(
      <ReceiptExtraDetails
        presentation="sheet"
        fields={[
          { section: 'Quote', label: 'Invoice', value: 'short', copyValue: 'complete invoice' },
          { section: 'Quote', label: 'Quote ID', value: 'quote-id' },
          {
            section: 'Transaction',
            label: 'Date',
            value: 'local date',
            fullValue: '2026-01-01T00:00:00.000Z',
          },
        ]}
      />,
    );
  });
  const button = tree.root.findByProps({ children: 'Copy' });
  expect(button.props).toMatchObject({
    fullWidth: false,
    flex: 1,
    size: 'medium',
    emphasis: 'secondary',
  });
  await act(async () => button.props.onPress());
  expect(mockCopy).toHaveBeenCalledWith(
    'Quote\nInvoice: complete invoice\nQuote ID: quote-id\n\nTransaction\nDate: 2026-01-01T00:00:00.000Z',
    expect.anything(),
  );
  expect(mockFeedback).toHaveBeenCalledTimes(1);
  const share = tree.root.findByProps({ children: 'Share' });
  expect(share.parent).toBe(button.parent);
  expect(share.props).toMatchObject({
    fullWidth: false,
    flex: 1,
    size: 'medium',
    emphasis: 'secondary',
  });
  await act(async () => share.props.onPress());
  expect(Share.share).toHaveBeenCalledWith({
    title: 'Payment details',
    message: mockCopy.mock.calls[0][0],
  });
  expect(tree.root.findAllByProps({ children: 'Done' })).toHaveLength(0);
});
it('omits the disclosure when no additional fields exist', async () => {
  await act(async () => {
    tree = create(<ReceiptExtraDetails fields={[]} />);
  });
  expect(tree.toJSON()).toBeNull();
});
it('keeps identifiers hidden until requested and preserves complete copy values', async () => {
  await act(async () => {
    tree = create(
      <ReceiptExtraDetails
        presentation="inline"
        fields={[{ label: 'Invoice', value: 'short', copyValue: 'complete invoice' }]}
      />,
    );
  });
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(0);
  const toggle = () => tree.root.findByType('Button' as any);
  expect(toggle().props).toMatchObject({
    emphasis: 'secondary',
    size: 'small',
    fullWidth: false,
    accessibilityState: { expanded: false },
  });
  await act(async () => toggle().props.onPress());
  const rows = tree.root.findAllByType('Row' as any);
  expect(toggle().props.accessibilityState.expanded).toBe(true);
  expect(rows[0].props).toMatchObject({
    label: 'Invoice',
    copyValue: 'complete invoice',
    isCopyable: true,
  });
  await act(async () => toggle().props.onPress());
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(0);
});
