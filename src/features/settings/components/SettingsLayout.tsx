import React from 'react';
import { Linking } from 'react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import { Check, ChevronRight, ExternalLink } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '~/shared/ui/AppPressable';
import type { AppButtonIcon } from '~/shared/ui/AppButton';
import { appBorders, appDimensions, appIconSizes, appSpacing } from '~/shared/theme';
import { AppText } from '~/shared/ui/AppText';

export function SettingsPage({
  children,
  keyboardShouldPersistTaps,
}: {
  children: React.ReactNode;
  keyboardShouldPersistTaps?: 'handled';
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      flex={1}
      bg="$background"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      <YStack p={appSpacing.page} gap="$5" pb={Math.max(insets.bottom, 16) + 16}>
        {children}
      </YStack>
    </ScrollView>
  );
}

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <YStack bg="$gray2" rounded="$6" overflow="hidden">
      {rows.map((child, index) => (
        <React.Fragment key={React.isValidElement(child) ? (child.key ?? index) : index}>
          {index > 0 && <YStack height={appBorders.separator} width="100%" bg="$background" />}
          {child}
        </React.Fragment>
      ))}
    </YStack>
  );
}

export function SettingsRow({
  title,
  value,
  description,
  icon: Icon,
  onPress,
  external,
  selected,
  disabled,
  destructive,
  selectionRole = 'radio',
}: {
  title: string;
  value?: string;
  description?: string;
  icon?: AppButtonIcon;
  onPress?: () => void;
  external?: boolean;
  selected?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  selectionRole?: 'radio' | 'checkbox';
}) {
  const color = destructive ? '$red10' : external ? '$blue10' : '$color';
  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={
        selected !== undefined ? selectionRole : external ? 'link' : onPress ? 'button' : 'text'
      }
      accessibilityState={selected !== undefined ? { checked: selected } : undefined}
      accessibilityLabel={[title, value, description].filter(Boolean).join(', ')}
      minHeight={appDimensions.touchTarget}
      px={appSpacing.page}
      py={appSpacing.compact}
      flexDirection="row"
      items="center"
      gap={appSpacing.gap}
      opacity={disabled ? 0.5 : 1}
      pressStyle={onPress ? { bg: '$gray3' } : undefined}
      hoverStyle={onPress ? { bg: '$gray3' } : undefined}
    >
      {Icon && (
        <XStack width={appIconSizes.list} items="center" justify="center" aria-hidden>
          {React.isValidElement(Icon)
            ? React.cloneElement(Icon as React.ReactElement<any>, {
                size: appIconSizes.list,
                color,
              })
            : React.createElement(Icon as React.ComponentType<any>, {
                size: appIconSizes.list,
                color,
                strokeWidth: 1.8,
              })}
        </XStack>
      )}
      <YStack flex={1} gap="$1">
        <AppText variant="label1" color={color}>
          {title}
        </AppText>
        {description && (
          <AppText variant="body2" tone="secondary">
            {description}
          </AppText>
        )}
      </YStack>
      {value && (
        <Text fontSize="$3" color="$gray10" maxWidth="40%" numberOfLines={1}>
          {value}
        </Text>
      )}
      {selected !== undefined ? (
        selected && <Check size={appIconSizes.list} color="$blue10" />
      ) : external ? (
        <ExternalLink size={appIconSizes.navigationCue} color="$gray10" />
      ) : onPress ? (
        <ChevronRight size={appIconSizes.navigationCue} color="$gray10" />
      ) : null}
    </AppPressable>
  );
}

export function SettingsDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="$3" color="$gray10" lineHeight={19}>
      {children}
    </Text>
  );
}

export function SettingsMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <YStack rounded="$6" bg={error ? '$red3' : '$gray2'} p="$4">
      <Text
        color={error ? '$red11' : '$color'}
        accessibilityRole={error ? 'alert' : undefined}
        accessibilityLiveRegion="polite"
      >
        {children}
      </Text>
    </YStack>
  );
}

export async function openSettingsLink(url: string) {
  await Linking.openURL(url);
}
