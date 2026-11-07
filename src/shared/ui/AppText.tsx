import React, { forwardRef } from 'react';
import { Text, type TextProps } from 'tamagui';
import { appTypography } from '~/shared/theme';

export type AppTextVariant = keyof typeof appTypography;
export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
};

const tones = {
  primary: '$color',
  secondary: '$gray10',
  success: '$green10',
  warning: '$orange10',
  error: '$red10',
} as const;

/** Named app typography; Tamagui resolves the existing Inter faces and text scaling. */
export const AppText = forwardRef<React.ComponentRef<typeof Text>, AppTextProps>(function AppText(
  { variant = 'body2', tone = 'primary', ...props },
  ref,
) {
  return <Text ref={ref} color={tones[tone]} {...appTypography[variant]} {...props} />;
});
