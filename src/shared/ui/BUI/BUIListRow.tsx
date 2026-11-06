import React from 'react';
import { ExternalLink } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIIcon } from './BUIIcon';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';
import { buiRowLayout, buiSeparator } from './layout';

export type BUIListRowProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  tags?: React.ReactNode;
  trailing?: React.ReactNode;
  value?: string;
  destination?: 'internal' | 'external';
  tone?: 'default' | 'destructive';
  subtitleTone?: 'default' | 'success' | 'warning' | 'error';
  minHeight?: number;
  paddingY?: number;
  textGap?: boolean;
  maxTitleLines?: number;
  maxSubtitleLines?: number;
  align?: 'center' | 'top';
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  role?: 'button' | 'radio' | 'checkbox' | 'switch';
  checked?: boolean;
  expanded?: boolean;
};

export function BUIListRow({
  title,
  subtitle,
  description,
  leading,
  tags,
  trailing,
  value,
  destination,
  tone = 'default',
  subtitleTone = 'default',
  minHeight = 56,
  paddingY = buiRowLayout.paddingY,
  textGap = true,
  maxTitleLines = 1,
  maxSubtitleLines = 1,
  align = 'center',
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  role,
  checked,
  expanded,
}: BUIListRowProps) {
  const c = useBUITheme();
  const hasSubtitle =
    typeof subtitle === 'string'
      ? subtitle.trim().length > 0
      : subtitle != null && subtitle !== false;
  const label =
    accessibilityLabel ??
    [title, subtitle, description, value]
      .filter((item) => typeof item === 'string' && item.trim())
      .join(', ');
  const content = (
    <>
      {leading != null && (
        <YStack
          style={{ marginEnd: buiRowLayout.iconGap }}
          flexShrink={0}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {leading}
        </YStack>
      )}
      <YStack flex={1} minWidth={0} gap={textGap ? buiRowLayout.textGap : 0}>
        <XStack gap={8} items="center">
          {typeof title === 'string' ? (
            <BUIText
              flexShrink={1}
              kind="label1"
              numberOfLines={maxTitleLines}
              color={tone === 'destructive' ? c.negative : c.text}
            >
              {title}
            </BUIText>
          ) : (
            title
          )}
          {tags}
        </XStack>
        {hasSubtitle &&
          (typeof subtitle === 'string' ? (
            <BUIText
              kind="body2"
              lineHeight={undefined}
              numberOfLines={maxSubtitleLines}
              color={
                { default: c.muted, success: c.positive, warning: c.warning, error: c.negative }[
                  subtitleTone
                ]
              }
            >
              {subtitle}
            </BUIText>
          ) : (
            subtitle
          ))}
        {description != null &&
          (typeof description === 'string' ? (
            <BUIText kind="body2" color={c.muted}>
              {description}
            </BUIText>
          ) : (
            description
          ))}
      </YStack>
      {(trailing != null || value !== undefined || (destination && onPress)) && (
        <XStack
          style={{ marginStart: buiRowLayout.trailingGap }}
          gap={8}
          items="center"
          flexShrink={0}
        >
          {value !== undefined && (
            <BUIText kind="label1" color={c.muted}>
              {value}
            </BUIText>
          )}
          {trailing}
          {destination &&
            onPress &&
            (destination === 'internal' ? (
              <BUIIcon name="chevron" tone="tertiary" />
            ) : (
              <ExternalLink size={16} color={c.iconTertiary} />
            ))}
        </XStack>
      )}
    </>
  );
  const layout = {
    minHeight,
    px: buiRowLayout.paddingX,
    py: paddingY,
    flexDirection: 'row' as const,
    items: align === 'top' ? ('flex-start' as const) : ('center' as const),
    opacity: disabled ? 0.48 : 1,
  };
  if (!onPress && !onLongPress)
    return (
      <XStack
        {...layout}
        accessible={!!role || !!accessibilityLabel}
        accessibilityLabel={accessibilityLabel ?? (role ? label : undefined)}
        accessibilityRole={role}
        accessibilityState={role ? { checked, disabled } : undefined}
      >
        {content}
      </XStack>
    );
  return (
    <AppPressable
      {...layout}
      accessibilityLabel={label || undefined}
      accessibilityRole={role ?? 'button'}
      accessibilityState={{
        disabled,
        ...(checked === undefined ? {} : { checked }),
        ...(expanded === undefined ? {} : { expanded }),
      }}
      disabled={disabled}
      onPress={() => {
        if (!disabled) onPress?.();
      }}
      onLongPress={
        onLongPress
          ? () => {
              if (!disabled) onLongPress();
            }
          : undefined
      }
      pressStyle={{ bg: c.highlighted, opacity: 1 }}
    >
      {content}
    </AppPressable>
  );
}

export function BUIListSeparator({
  extraStartInset = 0,
  thickness = buiSeparator.thickness,
}: {
  extraStartInset?: number;
  thickness?: number;
}) {
  const c = useBUITheme();
  return (
    <YStack
      pointerEvents="none"
      position="absolute"
      b={0}
      l={0}
      r={0}
      height={thickness}
      style={{ marginStart: buiSeparator.startInset + extraStartInset }}
      bg={c.separator}
    />
  );
}

export function BUIListGroup({
  children,
  inset = 16,
  separatorExtraInset = 0,
  separators = true,
}: {
  children: React.ReactNode;
  inset?: number;
  separatorExtraInset?: number;
  separators?: boolean;
}) {
  const c = useBUITheme();
  const rows = React.Children.toArray(children);
  if (!rows.length) return null;
  return (
    <YStack mx={inset} rounded={16} bg={c.surface} overflow="hidden">
      {rows.map((child, index) => (
        <YStack key={React.isValidElement(child) ? (child.key ?? index) : index}>
          {child}
          {separators && index < rows.length - 1 && (
            <BUIListSeparator extraStartInset={separatorExtraInset} />
          )}
        </YStack>
      ))}
    </YStack>
  );
}

export function BUIListCheckRow({
  checked,
  onCheckedChange,
  role = 'checkbox',
  ...props
}: Omit<BUIListRowProps, 'onPress' | 'checked'> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const c = useBUITheme();
  return (
    <BUIListRow
      {...props}
      role={role}
      checked={checked}
      trailing={checked ? <BUIIcon name="check" size={28} color={c.primary} /> : undefined}
      onPress={
        onCheckedChange ? () => onCheckedChange(role === 'radio' ? true : !checked) : undefined
      }
    />
  );
}

export function BUIListHeader({
  title,
  description,
  trailing,
  onPress,
}: {
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const c = useBUITheme();
  const titleContent = (
    <XStack items="center" gap={2}>
      <BUIText kind="label1" accessibilityRole={onPress ? undefined : 'header'}>
        {title}
      </BUIText>
      {onPress && <BUIIcon name="chevron" tone="tertiary" />}
    </XStack>
  );
  return (
    <YStack px={16} py={12}>
      <XStack items="center" justify="space-between" gap={8}>
        {onPress ? (
          <AppPressable
            minHeight={20}
            accessibilityLabel={title}
            onPress={onPress}
            pressStyle={{ opacity: 1 }}
          >
            {titleContent}
          </AppPressable>
        ) : (
          titleContent
        )}
        {trailing}
      </XStack>
      {description !== undefined && (
        <BUIText kind="body2" lineHeight={undefined} color={c.muted}>
          {description}
        </BUIText>
      )}
    </YStack>
  );
}
