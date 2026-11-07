import React from 'react';
import { X } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIText } from './BUIText';
import { BUIIcon } from './BUIIcon';
import { useBUITheme } from './useBUITheme';

export function BUIBannerCard({
  title,
  action,
  artwork,
  onPress,
  onDismiss,
}: {
  title: string;
  action?: string;
  artwork?: React.ReactNode;
  onPress?: () => void;
  onDismiss: () => void;
}) {
  const c = useBUITheme();
  const content = (
    <XStack minHeight={90} items="center">
      <YStack flex={1} pl={16} pr={artwork ? 8 : 54} gap={4} justify="center">
        <BUIText kind="label2" numberOfLines={2}>
          {title}
        </BUIText>
        {action && (
          <XStack items="center" gap={2} opacity={0.64}>
            <BUIText kind="body3">{action}</BUIText>
            <BUIIcon name="chevron" size={12} />
          </XStack>
        )}
      </YStack>
      {artwork && (
        <YStack
          width={134}
          height={90}
          items="center"
          justify="center"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {artwork}
        </YStack>
      )}
    </XStack>
  );
  return (
    <YStack mx={16} minHeight={90} rounded={20} overflow="hidden" bg={c.surface}>
      {onPress ? (
        <AppPressable
          accessibilityLabel={`${title}${action ? `, ${action}` : ''}`}
          minHeight={90}
          onPress={onPress}
        >
          {content}
        </AppPressable>
      ) : (
        content
      )}
      <YStack
        pointerEvents="none"
        position="absolute"
        t={0}
        b={0}
        l={0}
        r={0}
        rounded={20}
        borderWidth={1}
        borderColor={c.tertiaryFill}
      />
      <AppPressable
        accessibilityLabel={`Dismiss ${title}`}
        position="absolute"
        t={0}
        r={0}
        width={54}
        height={44}
        minHeight={44}
        hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
        p={10}
        items="flex-end"
        justify="flex-start"
        onPress={onDismiss}
      >
        <YStack
          width={24}
          height={24}
          rounded={12}
          bg={c.alternateSurface}
          items="center"
          justify="center"
        >
          <X size={16} color={c.iconSecondary} />
        </YStack>
      </AppPressable>
    </YStack>
  );
}
