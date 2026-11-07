import React from 'react';
import { Theme, YStack, useThemeName, type TextProps } from 'tamagui';
import { BUICard } from '~/shared/ui/BUI/BUICard';
import { BUIText } from '~/shared/ui/BUI/BUIText';
import {
  BUIListRow,
  BUIListGroup,
  BUIListHeader,
  BUIListSeparator,
} from '~/shared/ui/BUI/BUIListRow';
import { buiSeparator } from '~/shared/ui/BUI/layout';
import { BUIAppearanceProvider } from '~/shared/ui/BUI/useBUITheme';
import { appSpacing } from '~/shared/theme/appearance';

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

export function MintText(props: React.ComponentProps<typeof BUIText>) {
  return <BUIText kind="body2" {...props} />;
}

export function MintRows({ children }: { children: React.ReactNode }) {
  return (
    <BUIListGroup inset={0} separators={false}>
      <YStack mt={-2}>{children}</YStack>
    </BUIListGroup>
  );
}

export function MintDivider() {
  return (
    <YStack height={2}>
      <BUIListSeparator thickness={2} extraStartInset={-buiSeparator.startInset} />
    </YStack>
  );
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
    <YStack>
      <YStack mx={-appSpacing.page}>
        <BUIListHeader title={title} description={description} />
      </YStack>
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

/** BUI rows keep facts readable on narrow screens and grow with long values. */
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
  return (
    <YStack>
      <MintDivider />
      <BUIListRow
        title={
          <BUIText kind="label2" color={labelColor ?? '$color'}>
            {label}
          </BUIText>
        }
        subtitle={
          value == null ? undefined : (
            <BUIText kind="body2" color={valueColor ?? '$gray10'}>
              {value}
            </BUIText>
          )
        }
        leading={Icon ? <Icon size={20} color={iconColor ?? '$iconSecondary'} /> : undefined}
        trailing={rightContent}
        destination={onPress && !rightContent ? 'internal' : undefined}
        minHeight={value == null ? 48 : 56}
        maxSubtitleLines={0}
        accessibilityLabel={
          accessibilityLabel ??
          (onPress
            ? [label, typeof value === 'string' ? value : undefined].filter(Boolean).join(', ')
            : undefined)
        }
        disabled={disabled}
        expanded={expanded}
        onPress={onPress}
      />
    </YStack>
  );
}
