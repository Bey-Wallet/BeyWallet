import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { createContext, useContext } from 'react';
import { XStack, YStack, Text } from 'tamagui';
import { Copy, ChevronRight } from '@tamagui/lucide-icons';

import { hapticService } from '~/services/platform/hapticService';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { appBorders, appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';

const CompactTableContext = createContext(true);
const TableRowContext = createContext<string | null>(null);
export type ListTableVariant = 'filled' | 'outlined';
const ListTableVariantContext = createContext<ListTableVariant>('filled');
export const ListTableVariantProvider = ListTableVariantContext.Provider;

export function ListTable({
  children,
  compact = true,
  variant: variantProp,
  separators = true,
  ...props
}: {
  children: React.ReactNode;
  compact?: boolean;
  variant?: ListTableVariant;
  separators?: boolean;
  [key: string]: any;
}) {
  const inheritedVariant = useContext(ListTableVariantContext);
  const variant = variantProp ?? inheritedVariant;
  return (
    <CompactTableContext.Provider value={compact}>
      <YStack
        gap="$0"
        bg={variant === 'outlined' ? 'transparent' : '$gray2'}
        borderWidth={variant === 'outlined' ? 2 : 0}
        borderColor="$borderColor"
        rounded="$6"
        overflow="hidden"
        {...props}
      >
        <TableRowContext.Provider
          value={separators ? (variant === 'outlined' ? '$borderColor' : '$background') : null}
        >
          {/* Each row owns its divider, including rows returned by fragments/helpers.
              Clip the first divider above the group's top edge. */}
          <YStack testID="list-table-rows" mt={separators ? -appBorders.separator : 0}>
            {children}
          </YStack>
        </TableRowContext.Provider>
      </YStack>
    </CompactTableContext.Provider>
  );
}

export function ListTableRow({
  label,
  description,
  value,
  isCopyable,
  copyValue,
  onCopy,
  onPress,
  icon: Icon,
  iconSize = 20,
  iconColor,
  labelColor,
  labelNumberOfLines,
  valueColor,
  iconAfter,
  rightContent,
  multiline,
  expandValue = false,
  hideLabel = false,
  compact: compactProp,
  disabled = false,
  selected,
  expanded,
}: {
  label: string;
  description?: string;
  value?: React.ReactNode;
  isCopyable?: boolean;
  copyValue?: string;
  onCopy?: () => void;
  onPress?: () => void;
  icon?: any;
  iconSize?: number;
  iconColor?: string;
  labelColor?: string;
  labelNumberOfLines?: number;
  valueColor?: string;
  iconAfter?: React.ReactNode;
  rightContent?: React.ReactNode;
  multiline?: boolean;
  /** Let long values use all remaining width after the label. */
  expandValue?: boolean;
  hideLabel?: boolean;
  compact?: boolean;
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
}) {
  const toast = useAppToast();
  const inheritedCompact = useContext(CompactTableContext);
  const dividerColor = useContext(TableRowContext);
  const compact = compactProp ?? inheritedCompact;
  const wrap = compact || multiline;

  const handleCopy = async (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    if (disabled) return;
    if (onCopy) {
      onCopy();
      return;
    }
    const textToCopy = copyValue || (typeof value === 'string' ? value : '');
    if (textToCopy) {
      if (!(await copyWithFeedback(textToCopy, toast))) return;
      hapticService.acknowledge();
      toast.showFeedback(interactionCopy.copiedToClipboard);
    }
  };

  const hasTrailing = value != null || rightContent || isCopyable || onPress;

  const content = (
    <>
      {dividerColor && (
        <YStack
          testID="list-table-divider"
          height={appBorders.separator}
          width="100%"
          bg={dividerColor}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <XStack
        justify="space-between"
        items="center"
        minHeight={compact ? appDimensions.touchTarget : appDimensions.row}
        py={appSpacing.gap}
        px={appSpacing.page}
        gap={appSpacing.compact}
      >
        {!hideLabel && (
          <XStack
            items="center"
            gap="$2"
            flex={expandValue ? undefined : 1}
            flexShrink={expandValue ? 0 : 1}
            minWidth={0}
          >
            {Icon && (
              <XStack width={Math.max(22, iconSize)} flexShrink={0} items="center" justify="center">
                <Icon size={iconSize} color={iconColor || '$iconSecondary'} />
              </XStack>
            )}
            <YStack flex={expandValue ? undefined : 1} flexShrink={1} minWidth={0}>
              <Text
                fontFamily="$body"
                {...appTypography.body1}
                color={labelColor || '$gray10'}
                flexShrink={1}
                numberOfLines={labelNumberOfLines ?? (wrap ? undefined : 1)}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
              {description != null && (
                <Text
                  fontFamily="$body"
                  {...appTypography.body2}
                  color="$gray10"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {description}
                </Text>
              )}
            </YStack>
          </XStack>
        )}

        {hasTrailing && (
          <XStack
            gap="$2"
            items="center"
            minWidth={wrap ? 0 : undefined}
            maxWidth={expandValue ? '100%' : wrap ? '60%' : undefined}
            width={hideLabel ? '100%' : undefined}
            flex={expandValue ? 1 : undefined}
            flexShrink={wrap ? 1 : 0}
            justify="flex-end"
          >
            {typeof value === 'string' || typeof value === 'number' ? (
              <Text
                fontFamily="$body"
                {...appTypography.label1}
                text="right"
                color={valueColor || '$color'}
                numberOfLines={wrap ? undefined : 1}
                flexShrink={wrap ? 1 : undefined}
                style={wrap ? { minWidth: 0 } : { maxWidth: 200 }}
              >
                {value}
              </Text>
            ) : (
              value
            )}

            {rightContent}
            {iconAfter}

            {isCopyable && (
              <AppIconButton
                variant="default"
                emphasis="ghost"
                size="xxsmall"

                accessibilityLabel="Copy"
                disabled={disabled}
                icon={<Copy size={16} color="$gray10" />}
                onPress={handleCopy}
              />
            )}
            {onPress && !isCopyable && !rightContent && <ChevronRight size={16} color="$gray10" />}
          </XStack>
        )}
      </XStack>
    </>
  );

  if (onPress) {
    return (
      <YStack
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{
          disabled,
          ...(selected === undefined ? {} : { selected }),
          ...(expanded === undefined ? {} : { expanded }),
        }}
        minHeight={48}
        disabled={disabled}
        opacity={disabled ? 0.5 : 1}
        pressStyle={{ opacity: 0.7, backgroundColor: '$gray3' }}
        onPress={disabled ? undefined : onPress}
      >
        {content}
      </YStack>
    );
  }

  return content;
}
