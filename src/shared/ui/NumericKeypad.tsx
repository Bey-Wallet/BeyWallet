import { AppPressable } from '~/shared/ui/AppPressable';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton, type AppButtonIcon } from '~/shared/ui/AppButton';
import React, { useCallback, useMemo } from 'react';
import { YStack, XStack, Text, View } from 'tamagui';
import { Delete } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';

interface NumericKeypadProps {
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel: string;
  isLoading?: boolean;
  loadingText?: string;
  maxAmount?: number;
  currency?: string;
  allowDecimal?: boolean;
  showBalance?: boolean;
  showAmountDisplay?: boolean;
  showConfirmButton?: boolean;
  confirmDisabled?: boolean;
  confirmIcon?: AppButtonIcon;
}

// Keypad grid — defined once, never recreated
const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'delete'],
] as const;

/**
 * Individual number button — extracted to module scope and memoized.
 * This prevents React from unmounting/remounting all 10 buttons on every keystroke.
 */
const NumButton = React.memo(
  ({ digit, onPress }: { digit: string; onPress: (d: string) => void }) => (
    <AppPressable
      width="100%"
      height={56}
      onPress={() => onPress(digit)}
      pressStyle={{ bg: '$colorTransparent', borderColor: '$colorTransparent', scale: 1.5 }}
      flexDirection="row"
      items="center"
      justify="center"
      gap={8}
    >
      <Text
        fontFamily="$display"
        fontSize={32}
        fontVariant={['tabular-nums']}
        fontWeight="500"
        color="$color"
      >
        {digit}
      </Text>
    </AppPressable>
  ),
);

const DeleteButton = React.memo(({ onPress }: { onPress: () => void }) => (
  <AppIconButton
    variant="default"
    emphasis="ghost"
    size="large"
    icon={Delete}
    accessibilityLabel="Delete last digit"
    onPress={onPress}
  />
));

export function NumericKeypad({
  value,
  onValueChange,
  onConfirm,
  confirmLabel,
  isLoading = false,
  loadingText,
  maxAmount,
  currency = 'SATS',
  allowDecimal = true,
  showBalance = false,
  showAmountDisplay = true,
  showConfirmButton = true,
  confirmDisabled = false,
  confirmIcon = null,
}: NumericKeypadProps) {
  const amountNum = Number(value) || 0;
  const isOverBalance = maxAmount !== undefined && amountNum > maxAmount;
  const isBalanceZero = maxAmount !== undefined && maxAmount === 0;
  const canContinue = amountNum > 0 && !isOverBalance && !isLoading && !isBalanceZero;

  const handlePress = useCallback(
    (digit: string) => {
      if (isLoading || (digit === '.' && !allowDecimal)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(value === '0' ? digit : value + digit);
    },
    [value, onValueChange, isLoading, allowDecimal],
  );

  const handleDelete = useCallback(() => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (value.length <= 1) {
      onValueChange('0');
    } else {
      onValueChange(value.slice(0, -1));
    }
  }, [value, onValueChange, isLoading]);

  const handleConfirm = useCallback(() => {
    if (isLoading || confirmDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  }, [onConfirm, isLoading, confirmDisabled]);

  // Memoize amount display color
  const amountColor = isOverBalance || isBalanceZero ? '$red10' : '$color';

  return (
    <YStack flex={showAmountDisplay ? 1 : undefined} justify="space-between" width="100%">
      {/* Amount Display */}
      {showAmountDisplay && (
        <YStack items="center" py="$6" gap="$1">
          <XStack items="baseline" gap="$2">
            <Text fontFamily="$display" fontSize={56} fontWeight="600" color={amountColor}>
              {value}
            </Text>
            <Text fontSize={20} fontWeight="500" color="$gray10" mb="$2">
              {currency === 'SATS' ? 'sat' : currency}
            </Text>
          </XStack>
          {showBalance && maxAmount !== undefined && (
            <Text color="$gray10" fontSize="$3" fontWeight="500">
              Balance: {maxAmount} {currency === 'SATS' ? 'sat' : currency}
            </Text>
          )}
        </YStack>
      )}

      {/* Keypad and Action Button */}
      <YStack pb="$4">
        {/* Keypad Layout */}
        <YStack width="100%" gap="$0" pb="$4">
          {KEYPAD_ROWS.map((row, i) => (
            <XStack key={i} gap="$10">
              {row.map((digit) => (
                <YStack
                  key={digit}
                  flex={1}
                  flexBasis={0}
                  minWidth={0}
                  height={56}
                  items="center"
                  justify="center"
                >
                  {digit === 'delete' ? (
                    <DeleteButton onPress={handleDelete} />
                  ) : digit === '.' && !allowDecimal ? null : (
                    <NumButton digit={digit} onPress={handlePress} />
                  )}
                </YStack>
              ))}
            </XStack>
          ))}
        </YStack>
        {showConfirmButton && (
          <AppButton
            variant="default"
            emphasis="primary"
            size="large"
            loading={isLoading}
            loadingText={loadingText ?? confirmLabel}
            icon={confirmIcon || null}
            onPress={handleConfirm}
            disabled={!canContinue || confirmDisabled}
          >
            {confirmLabel}
          </AppButton>
        )}
      </YStack>
    </YStack>
  );
}
