import React from 'react';
import { Check, ChevronDown, EyeOff } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUICard, BUICardRow } from './BUICard';
import { BUIAvatar } from './BUIAvatar';
import { BUIListGroup, BUIListHeader, BUIListRow } from './BUIListRow';
import { BUIIcon } from './BUIIcon';
import { BUIText } from './BUIText';
import { BUISwitchVisual } from './BUISelectionControl';
import { useBUITheme } from './useBUITheme';

export type BUISetupItem = {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  tone: 'primary' | 'success' | 'warning';
  status?: 'pending' | 'complete';
  checked?: boolean;
  onPress?: () => void;
};

export function BUISetupCard({
  title = 'Finish setup',
  items,
  onSkip,
}: {
  title?: string;
  items: readonly BUISetupItem[];
  onSkip?: () => void;
}) {
  const c = useBUITheme();
  return (
    <YStack pb={16}>
      <BUIListHeader
        title={title}
        trailing={
          onSkip && (
            <AppPressable
              minHeight={20}
              accessibilityLabel="Skip setup preview"
              onPress={onSkip}
              flexDirection="row"
              items="center"
              gap={6}
            >
              <BUIText kind="label2" color={c.muted}>
                Skip
              </BUIText>
              <EyeOff size={16} color={c.iconSecondary} />
            </AppPressable>
          )
        }
      />
      <BUIListGroup>
        {items.map((item) => {
          const color = { primary: c.primary, success: c.positive, warning: c.warning }[item.tone];
          const complete = item.status === 'complete';
          return (
            <BUIListRow
              key={item.id}
              minHeight={76}
              paddingY={16}
              title={
                <BUIText kind="body2" flexShrink={1} opacity={complete ? 0.72 : 1}>
                  {item.title}
                </BUIText>
              }
              subtitle={item.description}
              role={item.checked === undefined ? undefined : 'switch'}
              checked={item.checked}
              leading={
                <YStack
                  width={44}
                  height={44}
                  rounded={22}
                  bg={`${color}1F`}
                  items="center"
                  justify="center"
                >
                  {item.icon}
                </YStack>
              }
              trailing={
                complete ? (
                  <Check size={22} color={c.positive} />
                ) : item.checked !== undefined ? (
                  <YStack
                    pointerEvents="none"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                  >
                    <BUISwitchVisual checked={item.checked} />
                  </YStack>
                ) : (
                  <BUIIcon name="chevron" tone="tertiary" />
                )
              }
              onPress={complete ? undefined : item.onPress}
              accessibilityLabel={`${item.title}${complete ? ', complete' : ''}${item.description ? `, ${item.description}` : ''}`}
            />
          );
        })}
      </BUIListGroup>
    </YStack>
  );
}

export function BUIMoreItemsCard({
  title = 'More assets',
  previews = [],
  onPress,
}: {
  title?: string;
  previews?: readonly string[];
  onPress: () => void;
}) {
  const c = useBUITheme();
  return (
    <BUICard onPress={onPress} label={title}>
      <XStack minHeight={60} px={16} py={12} items="center">
        {!!previews.length && (
          <XStack style={{ marginEnd: 12 }}>
            {previews.slice(0, 2).map((initials, index) => (
              <YStack
                key={`${index}-${initials}`}
                width={28}
                height={28}
                rounded={14}
                p={2}
                bg={c.surface}
                style={{ marginStart: index ? -8 : 0 }}
              >
                <BUIAvatar initials={initials} size={24} label="" />
              </YStack>
            ))}
          </XStack>
        )}
        <BUIText>{title}</BUIText>
        <ChevronDown size={16} color={c.iconSecondary} style={{ marginStart: 4 }} />
      </XStack>
    </BUICard>
  );
}

export function BUIHiddenItemsCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const c = useBUITheme();
  return (
    <BUICardRow
      title={title}
      subtitle={subtitle}
      paddingY={12}
      textGap={false}
      onPress={onPress}
      leading={
        <YStack width={44} height={44} rounded={22} bg={c.raised} items="center" justify="center">
          <EyeOff size={28} color={c.iconSecondary} />
        </YStack>
      }
    />
  );
}
