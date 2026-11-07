import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  ConversationPaymentCard,
  ConversationItemCard,
} from '~/features/people/components/ConversationItemCard';
import type { ConversationActivity } from '~/features/people/conversationActivity';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    ['AlertCircle', 'Check', 'ChevronRight', 'Clock3', 'X', 'ArrowDownLeft'].map((name) => [
      name,
      name,
    ]),
  ),
);

const base: ConversationActivity = {
  id: 'payment',
  kind: 'payment',
  direction: 'outgoing',
  time: 1,
  amount: 100,
  type: 'Ecash',
  status: 'Paid',
  requiresAction: false,
};
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('uses a small payment type label, left-aligned amount panel, note and trailing status', async () => {
  await act(async () => {
    tree = create(
      <ConversationPaymentCard
        item={{ ...base, note: 'Lunch' }}
        primaryAmount="100 sat"
        secondaryAmount="$0.10"
        onPress={() => {}}
      />,
    );
  });
  const labels = tree.root.findAllByType('Text' as any);
  expect(labels[0].props).toMatchObject({
    children: 'Ecash',
    fontSize: 13,
    fontWeight: '400',
  });
  expect(labels[1].props).toMatchObject({
    children: '100 sat',
    fontSize: 29,
    fontFamily: '$display',
  });
  expect(labels[2].props.children).toBe('$0.10');
  expect(labels[3].props.children).toBe('Lunch');
  expect(labels[4].props.children).toContain('Paid');
  expect(labels[4].props.fontSize).toBe(11);
  expect(
    tree.root.findAllByType('YStack' as any).find((node) => node.props.minHeight === 80)?.props,
  ).toMatchObject({ items: 'flex-start', justify: 'center' });
});

it.each([
  ['Ecash request', 'Ecash'],
  ['Lightning · Invoice', 'LN'],
  ['Lightning · LNURL', 'LN'],
  ['Bitcoin · On-chain', 'Bitcoin'],
])('labels %s as %s', async (type, label) => {
  await act(async () => {
    tree = create(<ConversationPaymentCard item={{ ...base, type }} primaryAmount="100 sat" />);
  });
  expect(tree.root.findAllByType('Text' as any)[0].props.children).toBe(label);
});

it('keeps unknown amounts readable and requests distinct from completed payments', async () => {
  const item: ConversationActivity = {
    ...base,
    direction: 'incoming',
    amount: undefined,
    type: 'Ecash request',
    status: 'Payment requested',
    requiresAction: true,
    paymentInput: { value: 'creq-test', type: 'Ecash request', route: 'cashu_request' },
  };
  await act(async () => {
    tree = create(<ConversationPaymentCard item={item} />);
  });
  const labels = tree.root.findAllByType('Text' as any);
  expect(labels[0].props.children).toBe('Ecash');
  expect(labels[1].props).toMatchObject({ children: 'Review payment', fontSize: 13 });
});

it.each([
  ['Claimed', 'Check'],
  ['Received', 'Check'],
  ['Paid', 'Check'],
  ['Awaiting claim', 'Clock3'],
  ['Awaiting payment', 'Clock3'],
  ['Sent to relay', 'Clock3'],
  ['Failed', 'AlertCircle'],
  ['Receipt unverified', 'AlertCircle'],
  ['Unresolved', 'AlertCircle'],
  ['Expired', 'X'],
  ['Refunded', 'ArrowDownLeft'],
])('keeps %s visible with the correct status marker', async (status, icon) => {
  await act(async () => {
    tree = create(<ConversationPaymentCard item={{ ...base, status }} primaryAmount="100 sat" />);
  });
  const marker = tree.root.findByProps({ accessibilityRole: 'image', accessibilityLabel: status });
  expect(marker.findByType(icon as any)).toBeDefined();
  const visibleStatus = status === 'Claimed' ? 'Paid' : status;
  expect(tree.root.findAllByType('Text' as any).at(-1)!.props.children).toContain(visibleStatus);
  if (!['Claimed', 'Received', 'Paid'].includes(status))
    expect(tree.root.findAllByType('Check' as any)).toHaveLength(0);
});

it('keeps sent cards neutral and right aligned, with the full note visible', async () => {
  await act(async () => {
    tree = create(
      <ConversationItemCard item={{ ...base, note: 'Shared dinner' }} primaryAmount="100 sat" />,
    );
  });
  expect(tree.root.findAllByType('YStack' as any)[0].props).toMatchObject({
    self: 'flex-end',
    width: 236,
  });
  expect(tree.root.findByType('Pressable' as any).props.bg).toBe('$gray2');
  expect(JSON.stringify(tree.toJSON())).toContain('Shared dinner');
});
