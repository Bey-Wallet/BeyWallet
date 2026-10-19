import React from 'react';
import { Text } from 'tamagui';

export function ModalHeaderTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      fontFamily="$body"
      fontSize={20}
      fontWeight="500"
      color="$color"
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}
