import React from 'react';
import { Linking } from 'react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import { Check, ChevronRight, ExternalLink } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '~/shared/ui/AppPressable';
import type { AppButtonIcon } from '~/shared/ui/AppButton';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';

export function SettingsPage({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView flex={1} bg="$background" showsVerticalScrollIndicator={false}>
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
          {index > 0 && <YStack height={2} width="100%" bg="$background" />}
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
  onPress: () => void;
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
      accessibilityRole={selected !== undefined ? selectionRole : external ? 'link' : 'button'}
      accessibilityState={selected !== undefined ? { checked: selected } : undefined}
      accessibilityLabel={[title, value].filter(Boolean).join(', ')}
      minHeight={appDimensions.touchTarget}
      px={appSpacing.page}
      py={appSpacing.compact}
      flexDirection="row"
      items="center"
      gap={appSpacing.gap}
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ bg: '$gray4' }}
      hoverStyle={{ bg: '$gray3' }}
    >
      {Icon && (
        <XStack width={20} items="center" justify="center" aria-hidden>
          {React.isValidElement(Icon)
            ? React.cloneElement(Icon as React.ReactElement<any>, { size: 20, color })
            : React.createElement(Icon as React.ComponentType<any>, {
                size: 20,
                color,
                strokeWidth: 1.8,
              })}
        </XStack>
      )}
      <YStack flex={1} gap="$1">
        <Text {...appTypography.label2} color={color}>
          {title}
        </Text>
        {description && (
          <Text {...appTypography.body3} color="$gray10">
            {description}
          </Text>
        )}
      </YStack>
      {value && (
        <Text fontSize="$3" color="$gray10" maxWidth="40%" numberOfLines={1}>
          {value}
        </Text>
      )}
      {selected !== undefined ? (
        selected && <Check size={20} color="$blue10" />
      ) : external ? (
        <ExternalLink size={18} color="$gray10" />
      ) : (
        <ChevronRight size={18} color="$gray10" />
      )}
    </AppPressable>
  );
}

export function SettingsDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="$3" color="$gray10" lineHeight={21}>
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
    <YStack rounded="$6" bg={error ? '$red3' : '$buttonDefaultSecondary'} p="$4">
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
