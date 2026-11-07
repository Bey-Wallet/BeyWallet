import React from 'react';
import { Text, type TextProps } from 'tamagui';
import { useBUITheme } from './useBUITheme';
import { buiTypography, type BUITypeRole } from './typography';

export function BUIText({ kind = 'label1', style, ...props }: TextProps & { kind?: BUITypeRole }) {
  const theme = useBUITheme();
  return (
    <Text
      color={theme.text}
      {...buiTypography[kind]}
      {...props}
      style={[{ includeFontPadding: false }, style]}
    />
  );
}
