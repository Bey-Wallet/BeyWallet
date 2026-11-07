import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';
jest.mock('tamagui', () => ({ YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({ ChevronDown: 'Down', ChevronUp: 'Up' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
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
