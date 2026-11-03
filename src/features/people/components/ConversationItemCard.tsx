import React from 'react';
import {
  AlertCircle,
  Check,
  Clock3,
  Zap,
  Banknote,
  HandCoins,
  X,
  ArrowDownLeft,
} from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import type { ConversationActivity } from '../conversationActivity';
import { appRadii } from '~/shared/theme/appearance';

export interface ConversationItemCardProps {
  item: ConversationActivity;
  primaryAmount?: string;
  secondaryAmount?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  onPay?: () => void;
  payDisabled?: boolean;
}

function palette(item: ConversationActivity) {
  if (item.direction === 'incoming' && item.requiresAction)
    return { background: '$buttonWarningSecondary', color: '$buttonWarningSecondaryText' } as const;
  if (item.direction === 'incoming')
    return { background: '$buttonDefaultSecondary', color: '$buttonDefaultSecondaryText' } as const;
  return { background: '$buttonDefaultPrimary', color: '$buttonDefaultPrimaryText' } as const;
}

export function ConversationTextBubble({ item }: ConversationItemCardProps) {
  const { color } = palette(item);
  const StateIcon =
    item.status === 'Failed' ? AlertCircle : item.status === 'Sending' ? Clock3 : Check;
  return (
    <XStack gap="$2" items="flex-end">
      <Text color={color} fontSize={14} lineHeight={21} flexShrink={1}>
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
  const typeLabel = item.type?.startsWith('Lightning') ? 'Lightning' : item.type || 'Payment';
  const StatusIcon = ['Claimed', 'Received', 'Paid'].includes(item.status)
    ? Check
    : ['Refunded', 'Reclaimed'].includes(item.status)
      ? ArrowDownLeft
      : ['Cancelled', 'Expired', 'Dismissed'].includes(item.status)
        ? X
        : item.requiresAction || /fail|unverified|unresolved|invalid|unsupported/i.test(item.status)
          ? AlertCircle
          : Clock3;
  return (
    <YStack gap="$1" minW={130}>
      <Text
        color={color}
        fontFamily={primaryAmount ? '$display' : '$body'}
        fontSize={primaryAmount ? '$8' : 14}
        lineHeight={primaryAmount ? '$8' : 22}
        fontWeight="600"
      >
        {primaryAmount ?? (item.paymentInput ? 'Review payment' : 'Amount unavailable')}
      </Text>
      {!!secondaryAmount && (
        <Text color={color} opacity={0.7} fontSize={11} lineHeight={14}>
          {secondaryAmount}
        </Text>
      )}
      {!!item.note && (
        <Text color={color} fontSize={13} lineHeight={18}>
          {item.note}
        </Text>
      )}
      <XStack gap={6} items="center" mt={4}>
        <TypeIcon size={14} color={color} />
        <Text
          color={color}
          opacity={0.75}
          fontSize={11}
          lineHeight={14}
          fontWeight="500"
          flex={1}
          flexShrink={1}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {typeLabel}
        </Text>
        <YStack accessibilityRole="image" accessibilityLabel={item.status} opacity={0.75}>
          <StatusIcon size={14} color={color} />
        </YStack>
      </XStack>
    </YStack>
  );
}

export function ConversationItemCard(props: ConversationItemCardProps) {
  const { item, primaryAmount, onPress, onLongPress, onPay, payDisabled } = props;
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
      onLongPress={onLongPress}
      accessibilityHint={onLongPress ? 'Touch and hold for message actions' : undefined}
      accessibilityActions={
        onLongPress ? [{ name: 'longpress', label: 'Message actions' }] : undefined
      }
      onAccessibilityAction={
        onLongPress
          ? (event) => {
              if (event.nativeEvent.actionName === 'longpress') onLongPress();
            }
          : undefined
      }
      self={item.direction === 'outgoing' ? 'flex-end' : 'flex-start'}
      minHeight={44}
      maxW={onPay ? '75%' : '85%'}
      px={14}
      py={payment ? 12 : 10}
      rounded={appRadii.card}
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
