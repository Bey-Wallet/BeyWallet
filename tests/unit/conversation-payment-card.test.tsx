import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConversationPaymentCard } from '~/features/people/components/ConversationItemCard';
import type { ConversationActivity } from '~/features/people/conversationActivity';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    ['AlertCircle', 'Check', 'Clock3', 'Zap', 'Banknote', 'HandCoins', 'X', 'ArrowDownLeft'].map(
      (name) => [name, name],
    ),
  ),
);

it('keeps the amount first and shortens Lightning labels without enlarging unknown-amount text', async () => {
  const item: ConversationActivity = {
    id: 'invoice',
    kind: 'payment',
    direction: 'incoming',
    time: 1,
    type: 'Lightning · Invoice',
    status: 'Payment requested',
    requiresAction: true,
    paymentInput: { value: 'lnbc-test', type: 'Lightning · Invoice', route: 'lightning' },
  };
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <ConversationPaymentCard item={item} primaryAmount="100 sat" secondaryAmount="$0.10" />,
      );
    });
    let labels = tree.root.findAllByType('Text' as any);
    expect(labels.map((node) => node.props.children)).toEqual(['100 sat', '$0.10', 'Lightning']);
    expect(labels[2].props).toMatchObject({ fontSize: 11, numberOfLines: 1 });
    await act(async () => tree.update(<ConversationPaymentCard item={item} />));
    labels = tree.root.findAllByType('Text' as any);
    expect(labels[0].props).toMatchObject({ children: 'Review payment', fontSize: 14 });
  } finally {
    await act(async () => tree?.unmount());
  }
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
])('shows a small %s icon without a visible status sentence', async (status, icon) => {
  const item: ConversationActivity = {
    id: 'payment',
    kind: 'payment',
    direction: 'outgoing',
    time: 1,
    amount: 100,
    type: 'Ecash',
    status,
    requiresAction: false,
  };
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(<ConversationPaymentCard item={item} primaryAmount="100 sat" />);
    });
    const marker = tree.root.findByProps({
      accessibilityRole: 'image',
      accessibilityLabel: status,
    });
    expect(marker.findByType(icon as any).props.size).toBe(14);
    expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).not.toContain(
      status,
    );
  } finally {
    await act(async () => tree?.unmount());
  }
});
