import React from 'react';
import { AlertCircle, Check, Clock3, X, ArrowDownLeft, ArrowUpRight } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import type { ConversationActivity } from '../conversationActivity';
import { conversationPaymentLabel } from '../conversationPaymentLabel';
import { appRadii, appSpacing, appTypography } from '~/shared/theme/appearance';

export interface ConversationItemCardProps {
  item: ConversationActivity;
  primaryAmount?: string;
  secondaryAmount?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  onPay?: () => void;
  payDisabled?: boolean;
}

export function ConversationTextBubble({ item }: ConversationItemCardProps) {
  return (
    <YStack gap={appSpacing.small}>
      <Text {...appTypography.body2} color="$color">
        {item.text}
      </Text>
    </YStack>
  );
}

export function ConversationPaymentCard({
  item,
  primaryAmount,
  secondaryAmount,
}: ConversationItemCardProps) {
  const outgoing = item.direction === 'outgoing';
  const foreground = '$color';
  const supporting = '$gray10';
  const preview = item.note?.trim() || item.payloadPreview;
  const alignment = outgoing ? 'left' : 'right';
  const DirectionIcon = outgoing ? ArrowUpRight : ArrowDownLeft;
  const complete = ['Claimed', 'Received', 'Paid'].includes(item.status);
  const returned = ['Refunded', 'Reclaimed'].includes(item.status);
  const ended = ['Cancelled', 'Expired', 'Dismissed'].includes(item.status);
  const attention =
    item.requiresAction || /fail|unverified|unresolved|invalid|unsupported/i.test(item.status);
  const StatusIcon = complete
    ? Check
    : returned
      ? ArrowDownLeft
      : ended
        ? X
        : attention
          ? AlertCircle
          : Clock3;
  const statusColor = complete ? '$green11' : attention ? '$buttonWarningSecondaryText' : '$gray10';
  const status =
    item.status === 'Claimed' ? (item.direction === 'outgoing' ? 'Paid' : 'Received') : item.status;
  const date = new Date(item.time);
  const today = new Date();
  const time =
    date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
        });
  return (
    <YStack gap={appSpacing.compact} minWidth={0}>
      <XStack items="center" justify="space-between" gap={appSpacing.small}>
        <Text {...appTypography.body2} color={supporting} flexShrink={1}>
          {conversationPaymentLabel(item)}
        </Text>
        <DirectionIcon
          size={14}
          color={supporting}
          accessibilityRole="image"
          accessibilityLabel={outgoing ? 'Outgoing payment' : 'Incoming payment'}
        />
      </XStack>
      {/* Layout adapted from Radar Android's AGPL-3.0 PaymentMessageView:
          https://github.com/radar-labs/radar-android/blob/b6c4fff179e47368f24444281a9b5a0ba4b70bc4/app/src/main/res/layout/payment_message_view.xml */}
      <YStack items={outgoing ? 'flex-start' : 'flex-end'} justify="center" gap={appSpacing.tiny}>
        <Text
          {...(primaryAmount ? appTypography.amount : appTypography.body2)}
          color={foreground}
          textAlign={alignment}
          maxWidth="100%"
        >
          {primaryAmount ?? (item.paymentInput ? 'Review payment' : 'Amount unavailable')}
        </Text>
        {!!secondaryAmount && (
          <Text {...appTypography.caption} color={supporting} textAlign={alignment} maxWidth="100%">
            {secondaryAmount}
          </Text>
        )}
      </YStack>
      {!!preview && (
        <Text
          {...appTypography.caption}
          color={supporting}
          numberOfLines={4}
          ellipsizeMode="tail"
          maxWidth="100%"
          flexShrink={1}
        >
          {preview}
        </Text>
      )}
      <XStack gap={appSpacing.small} items="center" justify="flex-end">
        <YStack
          accessibilityRole="image"
          accessibilityLabel={item.status}
          flexShrink={0}
          width={14}
          height={14}
          rounded={7}
          items="center"
          justify="center"
          bg={complete ? '$green11' : 'transparent'}
        >
          <StatusIcon size={complete ? 10 : 14} color={complete ? '$background' : statusColor} />
        </YStack>
        <Text
          {...appTypography.label3}
          color={attention && !complete ? statusColor : '$color'}
          flexShrink={1}
          minWidth={0}
          textAlign="right"
        >
          {status}
          {' · '}
          {time}
        </Text>
      </XStack>
    </YStack>
  );
}

export function ConversationItemCard(props: ConversationItemCardProps) {
  const { item, primaryAmount, onPress, onLongPress, onPay, payDisabled } = props;
  const payment = item.kind === 'payment';
  return (
    <YStack
      self={item.direction === 'outgoing' ? 'flex-end' : 'flex-start'}
      maxWidth={payment ? '70%' : '80%'}
      gap={payment ? appSpacing.small : appSpacing.compact}
    >
      <AppPressable
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={
          payment
            ? `${item.type || 'Payment'}, ${primaryAmount ?? 'Amount unavailable'}, ${item.status}${onPress ? '. Show payment details' : ''}`
            : `${item.text}. ${item.status}${onPress ? '. Show message details' : ''}`
        }
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityHint={
          onLongPress ? `Touch and hold for ${payment ? 'payment' : 'message'} actions` : undefined
        }
        accessibilityActions={
          onLongPress
            ? [{ name: 'longpress', label: payment ? 'Payment actions' : 'Message actions' }]
            : undefined
        }
        onAccessibilityAction={
          onLongPress
            ? (event) => {
                if (event.nativeEvent.actionName === 'longpress') onLongPress();
              }
            : undefined
        }
        minHeight={48}
        p={payment ? appSpacing.compact : appSpacing.gap}
        rounded={appRadii.card}
        bg="$gray2"
        hoverStyle={{ bg: '$gray3' }}
        pressStyle={{ bg: '$gray3' }}
      >
        {payment ? <ConversationPaymentCard {...props} /> : <ConversationTextBubble {...props} />}
      </AppPressable>
      {!!onPay && (
        <AppButton
          variant="accent"
          emphasis="primary"
          size="small"
          self="flex-end"
          fullWidth={false}
          accessibilityLabel={`Pay ${item.type || 'payment'}`}
          disabled={payDisabled}
          onPress={onPay}
        >
          Pay
        </AppButton>
      )}
    </YStack>
  );
}
