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
    ['AlertCircle', 'Check', 'ChevronRight', 'Clock3', 'X', 'ArrowDownLeft', 'ArrowUpRight'].map(
      (name) => [name, name],
    ),
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

it('uses a small type/direction header, flat sent amount, note and trailing status', async () => {
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
    children: 'Ecash token',
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
  const amount = labels[1].parent!;
  expect(amount.props).toMatchObject({ items: 'flex-start', justify: 'center', gap: 2 });
  expect(amount.props.minHeight).toBeUndefined();
  expect(amount.props.bg).toBeUndefined();
  expect(amount.props.rounded).toBeUndefined();
  expect(labels[1].props).toMatchObject({ textAlign: 'left', color: '$color' });
  expect(tree.root.findByType('ArrowUpRight' as any).props).toMatchObject({
    size: 14,
    accessibilityLabel: 'Outgoing payment',
  });
});

it('right-aligns received amounts and secondary values with an incoming direction icon', async () => {
  await act(async () => {
    tree = create(
      <ConversationPaymentCard
        item={{ ...base, direction: 'incoming' }}
        primaryAmount="100 sat"
        secondaryAmount="$0.10"
      />,
    );
  });
  const labels = tree.root.findAllByType('Text' as any);
  expect(labels[1].props).toMatchObject({ textAlign: 'right', color: '$color' });
  expect(labels[2].props).toMatchObject({ textAlign: 'right', color: '$gray10' });
  const amount = labels[1].parent!;
  expect(amount.props.items).toBe('flex-end');
  expect(amount.props.bg).toBeUndefined();
  expect(tree.root.findByType('ArrowDownLeft' as any).props.accessibilityLabel).toBe(
    'Incoming payment',
  );
});

it.each([
  'lnbc-preview-invoice',
  'cashuBpreview-token',
  'creqApreview-request',
  'alice@example.com',
])('shows an available payment payload %s as a muted four-line caption', async (payload) => {
  await act(async () => {
    tree = create(
      <ConversationPaymentCard
        item={{ ...base, direction: 'incoming', payloadPreview: payload }}
        primaryAmount="100 sat"
        secondaryAmount="$0.10"
      />,
    );
  });
  const labels = tree.root.findAllByType('Text' as any);
  const preview = labels.find((node) => node.props.children === payload)!;
  expect(preview.props).toMatchObject({
    numberOfLines: 4,
    ellipsizeMode: 'tail',
    color: '$gray10',
  });
  expect(preview.props.fontSize).toBe(
    labels.find((node) => node.props.children === '$0.10')!.props.fontSize,
  );
});

it('shows only the accompanying message instead of the payload on sent cards', async () => {
  await act(async () => {
    tree = create(
      <ConversationPaymentCard
        item={{ ...base, note: 'For dinner', payloadPreview: 'cashuBhidden-token' }}
        primaryAmount="100 sat"
      />,
    );
  });
  const preview = tree.root
    .findAllByType('Text' as any)
    .find((node) => node.props.children === 'For dinner')!;
  expect(preview.props).toMatchObject({
    numberOfLines: 4,
    fontSize: 9,
    color: '$gray10',
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('cashuBhidden-token');
});

it.each([
  ['Ecash request', 'Ecash request'],
  ['Ecash', 'Ecash token'],
  ['Lightning · Invoice', 'Lightning invoice'],
  ['Lightning · LNURL', 'LNURL payment'],
  ['Lightning · Address', 'Lightning address'],
  ['Lightning · BOLT12', 'BOLT12 offer'],
  ['Bitcoin · On-chain', 'Bitcoin payment'],
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
  expect(labels[0].props.children).toBe('Ecash request');
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

it('fits sent cards to their content with a neutral fill and full note visible', async () => {
  await act(async () => {
    tree = create(
      <ConversationItemCard item={{ ...base, note: 'Shared dinner' }} primaryAmount="100 sat" />,
    );
  });
  expect(tree.root.findAllByType('YStack' as any)[0].props).toMatchObject({
    self: 'flex-end',
    maxWidth: '70%',
  });
  expect(tree.root.findAllByType('YStack' as any)[0].props.width).toBeUndefined();
  expect(tree.root.findByType('Pressable' as any).props.bg).toBe('$gray2');
  expect(JSON.stringify(tree.toJSON())).toContain('Shared dinner');
});
