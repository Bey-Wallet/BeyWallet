import React, { useState } from 'react';
import { YStack } from 'tamagui';

export function PaymentQRFrame({
  children,
  accessibilityLabel,
  placeholder = false,
}: {
  children: (size: number) => React.ReactNode;
  accessibilityLabel: string;
  placeholder?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const size = Math.max(0, Math.min(280, width - 40));
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
          bg={placeholder ? '$buttonDefaultSecondary' : 'white'}
          p={20}
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$6"
        >
          {children(size)}
        </YStack>
      )}
    </YStack>
  );
}
