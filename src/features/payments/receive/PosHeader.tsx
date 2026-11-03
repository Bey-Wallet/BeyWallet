import React from 'react';
import { X } from '@tamagui/lucide-icons';
import { Text, XStack } from 'tamagui';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';

export function PosHeader({
  onBack,
  disabled,
  headerRight,
}: {
  onBack: () => void;
  disabled?: boolean;
  headerRight?: React.ReactNode;
}) {
  return (
    <XStack minHeight={64} items="center" gap="$2" pb="$2">
      <HeaderIconButton
        icon={X}
        accessibilityLabel="Close point of sale"
        disabled={disabled}
        onPress={onBack}
      />
      <Text
        flex={1}
        fontSize={14}
        fontWeight="600"
        color="$color"
        textAlign="center"
        accessibilityRole="header"
      >
        Checkout
      </Text>
      <XStack width={48}>{headerRight}</XStack>
    </XStack>
  );
}
