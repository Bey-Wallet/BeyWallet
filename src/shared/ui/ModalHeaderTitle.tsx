import React from 'react';
import { Text } from 'tamagui';
import { appTypography } from '~/shared/theme/appearance';

export function ModalHeaderTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      fontFamily="$body"
      {...appTypography.title3}
      color="$color"
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}
