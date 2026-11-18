import React from 'react';
import { Theme, XStack, YStack, useThemeName, type TextProps } from 'tamagui';
import { ChevronRight } from '@tamagui/lucide-icons';
import { AppText } from '~/shared/ui/AppText';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUICard } from '~/shared/ui/BUI/BUICard';
import { BUIText } from '~/shared/ui/BUI/BUIText';
import type { BUITypeRole } from '~/shared/ui/BUI/typography';
import { BUIAppearanceProvider } from '~/shared/ui/BUI/useBUITheme';
import { appSpacing, appTypography } from '~/shared/theme/appearance';

/** BUI surfaces are scoped to mint details and preview, including their sheets. */
export function MintAppearance({ children }: { children: React.ReactNode }) {
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  return (
    <BUIAppearanceProvider value={appearance}>
      <Theme name={appearance === 'light' ? 'light_bui' : 'dark_bui'}>{children}</Theme>
    </BUIAppearanceProvider>
  );
}

/** Rounded content cards grow with their text and actions. */
export function MintCard({
  children,
  padding = 16,
}: {
  children: React.ReactNode;
  padding?: number;
}) {
  return (
    <BUICard inset={0} padding={padding}>
      {children}
    </BUICard>
  );
}

const mintTextRoles: Record<BUITypeRole, keyof typeof appTypography> = {
  num1: 'display',
  num2: 'amountSmall',
  h1: 'title1',
  h2: 'title2',
  h3: 'title3',
  label1: 'label1',
  label2: 'label2',
  label3: 'label3',
  body1: 'body1',
  body2: 'body2',
  body3: 'body3',
  body4CAPS: 'caption',
  mono: 'mono',
};

export function MintText({ kind = 'body2', ...props }: React.ComponentProps<typeof BUIText>) {
  return <BUIText kind={kind} {...appTypography[mintTextRoles[kind]]} {...props} />;
}

export function MintRows({ children }: { children: React.ReactNode }) {
  return (
    <YStack bg="$gray2" rounded="$6" overflow="hidden">
      <YStack mt={-2}>{children}</YStack>
    </YStack>
  );
}

export function MintDivider() {
  return <YStack height={2} width="100%" bg="$background" />;
}

export function MintSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$2">
      <AppText variant="label3" tone="secondary" accessibilityRole="header" px="$2">
        {title}
      </AppText>
      {description && (
        <AppText variant="body2" tone="secondary" px="$2">
          {description}
        </AppText>
      )}
      {children}
    </YStack>
  );
}

type MintDetailRowProps = {
  label: string;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
  labelColor?: TextProps['color'];
  valueColor?: TextProps['color'];
  rightContent?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  expanded?: boolean;
  accessibilityLabel?: string;
};

/** Match the sheet's grouped rows and allow every value to wrap. */
export function MintDetailRow({
  label,
  value,
  icon: Icon,
  iconColor,
  labelColor,
  valueColor,
  rightContent,
  onPress,
  disabled,
  expanded,
  accessibilityLabel,
}: MintDetailRowProps) {
  const content = (
    <XStack
      minHeight={48}
      px={appSpacing.page}
      py={appSpacing.compact}
      gap="$3"
      items="center"
      accessible={!onPress && !!accessibilityLabel}
      accessibilityLabel={!onPress ? accessibilityLabel : undefined}
    >
      {Icon && (
        <XStack width={22} items="center" justify="center">
          <Icon size={20} color={iconColor ?? '$iconSecondary'} />
        </XStack>
      )}
      <AppText variant="label1" flex={1} color={labelColor ?? '$color'}>
        {label}
      </AppText>
      {value != null && (
        <YStack flex={1} minWidth={0} items="flex-end">
          {typeof value === 'string' || typeof value === 'number' ? (
            <AppText variant="body2" color={valueColor ?? '$gray10'} textAlign="right">
              {value}
            </AppText>
          ) : (
            value
          )}
        </YStack>
      )}
      {rightContent ?? (onPress ? <ChevronRight size={20} color="$gray10" /> : null)}
    </XStack>
  );
  return (
    <YStack>
      <MintDivider />
      {onPress ? (
        <AppPressable
          onPress={onPress}
          disabled={disabled}
          opacity={disabled ? 0.5 : 1}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ??
            [label, typeof value === 'string' ? value : undefined].filter(Boolean).join(', ')
          }
          accessibilityState={{ disabled, expanded }}
          pressStyle={{ bg: '$gray3' }}
        >
          {content}
        </AppPressable>
      ) : (
        content
      )}
    </YStack>
  );
}
