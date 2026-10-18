import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { createContext, useContext } from 'react';
import { XStack, YStack, Text, Separator } from 'tamagui';
import { Copy, ChevronRight } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';

const CompactTableContext = createContext(false);

export function ListTable({
  children,
  compact = false,
  ...props
}: {
  children: React.ReactNode;
  compact?: boolean;
  [key: string]: any;
}) {
  return (
    <CompactTableContext.Provider value={compact}>
      <YStack
        gap="$0"
        bg="$gray2"
        rounded="$6"
        overflow="hidden"
        separator={<Separator borderColor="$borderColor" opacity={0.5} />}
        {...props}
      >
        {children}
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
}) {
  const toast = useToastController();
  const inheritedCompact = useContext(CompactTableContext);
  const compact = compactProp ?? inheritedCompact;
  const wrap = compact || multiline;

  const handleCopy = async () => {
    if (disabled) return;
    if (onCopy) {
      onCopy();
      return;
    }
    const textToCopy = copyValue || (typeof value === 'string' ? value : '');
    if (textToCopy) {
      await Clipboard.setStringAsync(textToCopy);
      Haptics.selectionAsync();
      toast.show('Copied to clipboard', { kind: 'success' });
    }
  };

  const hasTrailing = value != null || rightContent || isCopyable || onPress;

  const content = (
    <XStack justify="space-between" items={wrap ? 'flex-start' : 'center'} py="$3" px="$4" gap="$2">
      <XStack items={wrap ? 'flex-start' : 'center'} gap="$2" flex={1} flexShrink={1} minWidth={0}>
        {Icon && <Icon size={18} color={iconColor || '$gray10'} />}
        <Text
          fontFamily="$body"
          fontSize={compact ? '$3' : '$4'}
          color={labelColor || '$gray10'}
          fontWeight={compact ? '400' : '600'}
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
          flex={compact ? 2 : undefined}
          minWidth={compact ? 0 : undefined}
          flexShrink={wrap ? 1 : 0}
          justify="flex-end"
        >
          {typeof value === 'string' || typeof value === 'number' ? (
            <Text
              fontFamily="$body"
              fontSize={compact ? '$3' : '$4'}
              text="right"
              fontWeight={compact ? '500' : '600'}
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
              emphasis="tertiary"
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
  );

  if (onPress) {
    return (
      <YStack
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
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
