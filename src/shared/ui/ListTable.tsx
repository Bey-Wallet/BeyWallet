import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { createContext, useContext } from 'react';
import { XStack, YStack, Text } from 'tamagui';
import { Copy, ChevronRight } from '@tamagui/lucide-icons';

import * as Haptics from 'expo-haptics';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';

const CompactTableContext = createContext(true);
const TableRowContext = createContext<string | null>(null);
export type ListTableVariant = 'filled' | 'outlined';
const ListTableVariantContext = createContext<ListTableVariant>('filled');
export const ListTableVariantProvider = ListTableVariantContext.Provider;

export function ListTable({
  children,
  compact = true,
  variant: variantProp,
  ...props
}: {
  children: React.ReactNode;
  compact?: boolean;
  variant?: ListTableVariant;
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
        <TableRowContext.Provider value={variant === 'outlined' ? '$borderColor' : '$background'}>
          {/* Each row owns its divider, including rows returned by fragments/helpers.
              Clip the first divider above the group's top edge. */}
          <YStack testID="list-table-rows" mt={-2}>
            {children}
          </YStack>
        </TableRowContext.Provider>
      </YStack>
    </CompactTableContext.Provider>
  );
}

export function ListTableRow({
  label,
  value,
  isCopyable,
  copyValue,
  onCopy,
  onPress,
  icon: Icon,
  iconColor,
  labelColor,
  valueColor,
  iconAfter,
  rightContent,
  multiline,
  compact: compactProp,
  disabled = false,
  selected,
  expanded,
}: {
  label: string;
  value?: React.ReactNode;
  isCopyable?: boolean;
  copyValue?: string;
  onCopy?: () => void;
  onPress?: () => void;
  icon?: any;
  iconColor?: string;
  labelColor?: string;
  valueColor?: string;
  iconAfter?: React.ReactNode;
  rightContent?: React.ReactNode;
  multiline?: boolean;
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
      Haptics.selectionAsync();
      toast.showFeedback(interactionCopy.copiedToClipboard);
    }
  };

  const hasTrailing = value != null || rightContent || isCopyable || onPress;

  const content = (
    <>
      {dividerColor && (
        <YStack
          testID="list-table-divider"
          height={2}
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
        <XStack items="center" gap="$2" flex={1} flexShrink={1} minWidth={0}>
          {Icon && (
            <XStack width={22} items="center" justify="center">
              <Icon size={20} color={iconColor || '$iconSecondary'} />
            </XStack>
          )}
          <Text
            fontFamily="$body"
            {...(compact ? appTypography.body2 : appTypography.body1)}
            color={labelColor || '$gray10'}
            flex={1}
            flexShrink={1}
            numberOfLines={wrap ? undefined : 1}
          >
            {label}
          </Text>
        </XStack>

        {hasTrailing && (
          <XStack
            gap="$2"
            items="center"
            minWidth={wrap ? 0 : undefined}
            maxWidth={wrap ? '60%' : undefined}
            flexShrink={wrap ? 1 : 0}
            justify="flex-end"
          >
            {typeof value === 'string' || typeof value === 'number' ? (
              <Text
                fontFamily="$body"
                {...(compact ? appTypography.label2 : appTypography.label1)}
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
