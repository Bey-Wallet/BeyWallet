import React from 'react';
import { AlertCircle, Check, Clock3, Zap, Banknote, HandCoins } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import type { ConversationActivity } from '../conversationActivity';

export interface ConversationItemCardProps {
  item: ConversationActivity;
  primaryAmount?: string;
  secondaryAmount?: string | null;
  onPress?: () => void;
  onPay?: () => void;
  payDisabled?: boolean;
}

function palette(item: ConversationActivity) {
  if (item.direction === 'incoming' && item.requiresAction)
    return { background: '$buttonWarningSecondary', color: '$buttonWarningSecondaryText' } as const;
  if (item.direction === 'incoming')
    return { background: '$buttonDefaultSecondary', color: '$buttonDefaultSecondaryText' } as const;
  if (item.kind === 'payment')
    return { background: '$buttonBrandedSecondary', color: '$buttonBrandedSecondaryText' } as const;
  return { background: '$buttonBrandedPrimary', color: '$buttonBrandedPrimaryText' } as const;
}

export function ConversationTextBubble({ item }: ConversationItemCardProps) {
  const { color } = palette(item);
  const StateIcon =
    item.status === 'Failed' ? AlertCircle : item.status === 'Sending' ? Clock3 : Check;
  return (
    <XStack gap="$2" items="flex-end">
      <Text color={color} fontSize={16} lineHeight={23} flexShrink={1}>
        {item.text}
      </Text>
      {item.direction === 'outgoing' && (
        <XStack
          pb={4}
          opacity={0.7}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <StateIcon size={12} color={color} />
        </XStack>
      )}
    </XStack>
  );
}

export function ConversationPaymentCard({
  item,
  primaryAmount,
  secondaryAmount,
}: ConversationItemCardProps) {
  const { color } = palette(item);
  const TypeIcon =
    item.type === 'Ecash request' ? HandCoins : item.type?.startsWith('Lightning') ? Zap : Banknote;
  return (
    <YStack gap="$2" minW={130}>
      <XStack gap={6} items="center">
        <TypeIcon size={14} color={color} />
        <Text color={color} opacity={0.75} fontSize={11} fontWeight="500" flexShrink={1}>
          {item.type || 'Payment'}
        </Text>
      </XStack>
      <Text color={color} fontSize={primaryAmount ? 24 : 16} lineHeight={29} fontWeight="600">
        {primaryAmount ?? (item.paymentInput ? 'Review payment' : 'Amount unavailable')}
      </Text>
      {!!secondaryAmount && (
        <Text color={color} opacity={0.7} fontSize={12}>
          {secondaryAmount}
        </Text>
      )}
      <XStack items="center" gap={5} mt={4}>
        {item.requiresAction && <AlertCircle size={13} color={color} />}
        <Text color={color} fontSize={11} fontWeight="600" flexShrink={1}>
          {item.status}
        </Text>
      </XStack>
    </YStack>
  );
}

export function ConversationItemCard(props: ConversationItemCardProps) {
  const { item, primaryAmount, onPress, onPay, payDisabled } = props;
  const payment = item.kind === 'payment';
  const { background } = palette(item);
  const card = (
    <AppPressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={
        payment
          ? `${item.type || 'Payment'}, ${primaryAmount ?? 'Amount unavailable'}, ${item.status}${onPress ? '. Show payment details' : ''}`
          : `${item.text}. ${item.status}${onPress ? '. Show message details' : ''}`
      }
      onPress={onPress}
      self={item.direction === 'outgoing' ? 'flex-end' : 'flex-start'}
      minHeight={44}
      maxW={onPay ? '75%' : '85%'}
      px={14}
      py={payment ? 12 : 10}
      rounded={16}
      bg={background}
    >
      {payment ? <ConversationPaymentCard {...props} /> : <ConversationTextBubble {...props} />}
    </AppPressable>
  );
  if (!onPay) return card;
  return (
    <XStack self="flex-start" items="center" gap="$2" flexWrap="wrap" maxW="100%">
      {card}
      <AppButton
        variant="default"
        emphasis="secondary"
        size="small"
        accessibilityLabel={`Pay ${item.type || 'payment'}`}
        disabled={payDisabled}
        onPress={onPay}
      >
        Pay
      </AppButton>
    </XStack>
  );
}
