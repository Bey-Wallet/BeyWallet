import React from 'react';
import { Banknote, HandCoins, Zap } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { UnreadBadge } from '~/shared/ui/UnreadBadge';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { ConversationAvatar } from './ConversationAvatar';
import { peopleRowTime, type PeopleListItem } from '../peopleListModel';

export const PeopleListRow = React.memo(function PeopleListRow({
  item,
  now,
  onPress,
}: {
  item: PeopleListItem;
  now: Date;
  onPress: () => void;
}) {
  const time = item.kind === 'search' ? '' : peopleRowTime(item.updatedAt, now);
  const Icon = item.icon === 'lightning' ? Zap : item.icon === 'request' ? HandCoins : Banknote;
  return (
    <AppPressable
      minHeight={76}
      py={14}
      flexDirection="row"
      items="center"
      gap={12}
      accessibilityLabel={`${item.name}${item.verified ? ', Verified NIP-05' : ''}, ${item.preview}${time ? `, ${time}` : ''}${item.unreadCount > 0 ? `, ${item.unreadCount} unread ${item.unreadCount === 1 ? 'item' : 'items'}` : ''}`}
      onPress={onPress}
    >
      <ConversationAvatar npub={item.npub} picture={item.picture} size={48} />
      <YStack flex={1} minWidth={0} gap={4}>
        <XStack items="center" gap={5}>
          <Text
            color="$color"
            fontSize={16}
            fontWeight={item.unread ? '700' : '600'}
            numberOfLines={1}
            flexShrink={1}
          >
            {item.name}
          </Text>
          {item.verified && <Nip05VerifiedBadge size={16} />}
        </XStack>
        <XStack gap={5} items="center">
          {item.icon && (
            <Icon
              size={14}
              color={item.kind === 'issue' ? '$buttonWarningSecondaryText' : '$gray10'}
            />
          )}
          <Text
            color={item.kind === 'issue' ? '$buttonWarningSecondaryText' : '$gray10'}
            fontSize={14}
            numberOfLines={1}
            flexShrink={1}
          >
            {item.preview}
          </Text>
        </XStack>
      </YStack>
      {(time || item.unread) && (
        <YStack self="stretch" items="flex-end" justify="space-between" maxW="28%" gap={5}>
          {!!time && (
            <Text fontSize={12} color="$gray10" numberOfLines={1}>
              {time}
            </Text>
          )}
          {item.unreadCount > 0 && (
            <YStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <UnreadBadge count={item.unreadCount} />
            </YStack>
          )}
        </YStack>
      )}
    </AppPressable>
  );
});
