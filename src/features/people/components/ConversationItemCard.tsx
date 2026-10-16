import React from 'react';
import { AlertCircle, Check, Clock3, Zap, WalletCards } from '@tamagui/lucide-icons';
import { Text, XStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import type { ConversationActivity } from '../conversationActivity';

export function ConversationItemCard({
  item,
  primaryAmount,
  secondaryAmount,
  onPress,
}: {
  item: ConversationActivity;
  primaryAmount?: string;
  secondaryAmount?: string | null;
  onPress: () => void;
}) {
  const outgoing = item.direction === 'outgoing';
  const payment = item.amount !== undefined;
  const warning = !outgoing && item.requiresAction;
  const background = warning
    ? '$buttonWarningSecondary'
    : payment && outgoing
      ? '$buttonBrandedSecondary'
      : outgoing
        ? '$surface10'
        : '$buttonDefaultSecondary';
  const color = warning
    ? '$buttonWarningSecondaryText'
    : payment && outgoing
      ? '$buttonBrandedSecondaryText'
      : outgoing
        ? 'white'
        : '$buttonDefaultSecondaryText';
  const StateIcon =
    item.status === 'Failed' ? AlertCircle : item.status === 'Sending' ? Clock3 : Check;
  const TypeIcon = item.type === 'Lightning' ? Zap : WalletCards;
  return (
    <AppPressable
      accessibilityLabel={
        payment
          ? `${item.type}, ${primaryAmount}, ${item.status}. Show payment details`
          : `${item.text}. ${outgoing ? item.status + '. ' : ''}Show message details`
      }
      onPress={onPress}
      self={outgoing ? 'flex-end' : 'flex-start'}
      minHeight={44}
      width={payment ? 264 : undefined}
      maxW="88%"
      px="$3.5"
      py="$3"
      my="$1"
      rounded="$5"
      gap="$1.5"
      bg={background}
      borderBottomRightRadius={outgoing ? 6 : 20}
      borderBottomLeftRadius={outgoing ? 20 : 6}
    >
      {payment ? (
        <>
          <XStack gap="$2" items="center">
            <TypeIcon size={16} color={color} />
            <Text
              color={color}
              fontSize="$2"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.8}
            >
              {item.type}
            </Text>
          </XStack>
          <Text color={color} fontSize="$8" fontWeight="800">
            {primaryAmount}
          </Text>
          {!!secondaryAmount && (
            <Text color={color} opacity={0.7} fontSize="$3">
              {secondaryAmount}
            </Text>
          )}
          <XStack items="center" gap="$1.5" mt="$2">
            {warning && <AlertCircle size={14} color={color} />}
            <Text color={color} fontSize="$2" fontWeight="600">
              {item.status}
            </Text>
          </XStack>
        </>
      ) : (
        <XStack gap="$2" items="flex-end">
          <Text color={color} fontSize="$5" lineHeight={23} flexShrink={1}>
            {item.text}
          </Text>
          {outgoing && (
            <XStack
              pb={3}
              opacity={0.65}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <StateIcon size={12} color={color} />
            </XStack>
          )}
        </XStack>
      )}
    </AppPressable>
  );
}
