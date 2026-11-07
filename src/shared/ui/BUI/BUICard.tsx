import React from 'react';
import { TriangleAlert } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIListRow, BUIListSeparator, type BUIListRowProps } from './BUIListRow';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';

export type BUICardPosition = 'single' | 'first' | 'middle' | 'last';

export function BUICard({
  children,
  inset = 16,
  padding = 0,
  position = 'single',
  separatorExtraInset = 0,
  onPress,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  inset?: number;
  padding?: number;
  position?: BUICardPosition;
  separatorExtraInset?: number;
  onPress?: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const c = useBUITheme();
  const shape = {
    borderTopLeftRadius: position === 'single' || position === 'first' ? 16 : 0,
    borderTopRightRadius: position === 'single' || position === 'first' ? 16 : 0,
    borderBottomLeftRadius: position === 'single' || position === 'last' ? 16 : 0,
    borderBottomRightRadius: position === 'single' || position === 'last' ? 16 : 0,
  };
  const content = (
    <>
      {onPress ? (
        <AppPressable
          accessibilityLabel={label}
          disabled={disabled}
          accessibilityState={{ disabled }}
          minHeight={48}
          p={padding}
          onPress={() => {
            if (!disabled) onPress();
          }}
          pressStyle={{ bg: c.highlighted, opacity: 1 }}
          opacity={disabled ? 0.48 : 1}
        >
          {children}
        </AppPressable>
      ) : (
        <YStack p={padding}>{children}</YStack>
      )}
      {(position === 'first' || position === 'middle') && (
        <BUIListSeparator extraStartInset={separatorExtraInset} />
      )}
    </>
  );
  return (
    <YStack mx={inset} bg={c.surface} overflow="hidden" style={shape}>
      {content}
    </YStack>
  );
}

export function BUICardRow({
  position,
  inset,
  separatorExtraInset,
  ...props
}: BUIListRowProps & {
  position?: BUICardPosition;
  inset?: number;
  separatorExtraInset?: number;
}) {
  return (
    <BUICard position={position} inset={inset} separatorExtraInset={separatorExtraInset}>
      <BUIListRow {...props} minHeight={props.minHeight ?? 76} />
    </BUICard>
  );
}

export function BUIWarningCard({
  children,
  maxLines = 3,
}: {
  children: string;
  maxLines?: number;
}) {
  const c = useBUITheme();
  return (
    <BUICard>
      <XStack px={16} py={12} gap={16} items="flex-start">
        <BUIText flex={1} kind="body2" numberOfLines={maxLines}>
          {children}
        </BUIText>
        <TriangleAlert size={16} color={c.iconSecondary} />
      </XStack>
    </BUICard>
  );
}
