import React from 'react';
import { Copy } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIListRow } from './BUIListRow';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';

export function BUIPropertyRow({
  title,
  value,
  description,
  prefix,
  postfix,
  large = false,
  maxValueLines = 1,
  onPress,
}: {
  title: string;
  value: string;
  description?: string;
  prefix?: React.ReactNode;
  postfix?: React.ReactNode;
  large?: boolean;
  maxValueLines?: number;
  onPress?: () => void;
}) {
  const c = useBUITheme();
  const content = (
    <>
      <XStack gap={4} items="center" flexShrink={1}>
        {large && prefix}
        <BUIText
          kind={large ? 'body1' : 'body2'}
          color={c.muted}
          numberOfLines={large ? 2 : 1}
          lineHeight={large ? undefined : 20}
          flexShrink={1}
        >
          {title}
        </BUIText>
      </XStack>
      <XStack
        flex={1}
        minWidth={0}
        gap={4}
        items={large ? 'center' : 'flex-start'}
        justify="flex-end"
      >
        {!large && prefix}
        <YStack flexShrink={1} minWidth={0} items="flex-end" gap={2}>
          <BUIText
            kind={large ? 'label1' : 'label2'}
            numberOfLines={maxValueLines}
            ellipsizeMode={maxValueLines === 1 ? 'middle' : 'tail'}
            textAlign="right"
          >
            {value}
          </BUIText>
          {large && description != null && (
            <BUIText kind="body2" lineHeight={undefined} color={c.muted} textAlign="right">
              {description}
            </BUIText>
          )}
        </YStack>
        {postfix}
      </XStack>
    </>
  );
  const layout = {
    px: large ? 16 : 19,
    py: large ? 16 : 12,
    flexDirection: 'row' as const,
    items: 'flex-start' as const,
    gap: 8,
  };
  return onPress ? (
    <AppPressable
      {...layout}
      minHeight={48}
      accessibilityLabel={`${title}, ${value}${description ? `, ${description}` : ''}`}
      onPress={onPress}
      pressStyle={{ bg: c.highlighted }}
    >
      {content}
    </AppPressable>
  ) : (
    <XStack {...layout}>{content}</XStack>
  );
}

export function BUICopyRow({
  title,
  value,
  leading,
  onCopy,
  maxValueLines = 2,
}: {
  title: string;
  value: string;
  leading?: React.ReactNode;
  onCopy: () => void;
  maxValueLines?: number;
}) {
  const c = useBUITheme();
  return (
    <BUIListRow
      minHeight={100}
      leading={leading}
      title={
        <BUIText kind="body2" lineHeight={undefined} color={c.muted}>
          {title}
        </BUIText>
      }
      subtitle={
        <BUIText kind="label1" numberOfLines={maxValueLines}>
          {value}
        </BUIText>
      }
      trailing={
        <AppPressable
          accessibilityLabel={`Copy ${title}`}
          minWidth={48}
          minHeight={48}
          items="center"
          justify="center"
          onPress={onCopy}
        >
          <Copy size={24} color={c.primary} />
        </AppPressable>
      }
    />
  );
}

export function BUIDescriptionRow({
  children,
  align = 'left',
}: {
  children: string;
  align?: 'left' | 'center' | 'right';
}) {
  const c = useBUITheme();
  return (
    <YStack p={16}>
      <BUIText kind="body2" color={c.muted} textAlign={align}>
        {children}
      </BUIText>
    </YStack>
  );
}

export function BUIContentRow({ title, description }: { title: string; description?: string }) {
  const c = useBUITheme();
  return (
    <YStack px={16} items="center" gap={4}>
      <BUIText kind="h3" textAlign="center">
        {title}
      </BUIText>
      {!!description?.trim() && (
        <BUIText kind="body1" color={c.muted} textAlign="center">
          {description}
        </BUIText>
      )}
    </YStack>
  );
}
