import React, { useState } from 'react';
import { YStack } from 'tamagui';

export function PaymentQRFrame({
  children,
  accessibilityLabel,
  placeholder = false,
  appearance = 'default',
}: {
  children: (size: number) => React.ReactNode;
  accessibilityLabel: string;
  placeholder?: boolean;
  appearance?: 'default' | 'pos';
}) {
  const [width, setWidth] = useState(0);
  const availableSize = Math.max(0, width - 40);
  const size = appearance === 'pos' ? availableSize : Math.min(240, availableSize);
  return (
    <YStack
      width="100%"
      items="center"
      gap="$3"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel={accessibilityLabel}
    >
      {size > 0 && (
        <YStack
          testID="payment-qr-surface"
          bg={appearance === 'pos' ? '$background' : placeholder ? '$gray2' : 'white'}
          p={20}
          borderWidth={appearance === 'pos' ? 0 : 1}
          borderColor="$borderColor"
          rounded={appearance === 'pos' ? 0 : '$6'}
        >
          {children(size)}
        </YStack>
      )}
    </YStack>
  );
}
