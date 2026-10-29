import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';
jest.mock('tamagui', () => ({ YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({ ChevronDown: 'Down', ChevronUp: 'Up' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
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
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(1);
  expect(tree.root.findByType('Row' as any).props.expanded).toBe(false);
  await act(async () => tree.root.findByType('Row' as any).props.onPress());
  const rows = tree.root.findAllByType('Row' as any);
  expect(rows[0].props.expanded).toBe(true);
  expect(rows[1].props).toMatchObject({
    label: 'Invoice',
    copyValue: 'complete invoice',
    isCopyable: true,
  });
  await act(async () => rows[0].props.onPress());
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(1);
});
