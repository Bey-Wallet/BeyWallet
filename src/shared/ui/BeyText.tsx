import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import { Text, useTheme, type TextProps } from 'tamagui';
import { beyColorKey, type BeyColorRole, type BeyTextVariant } from '~/shared/theme/bey';
import { getBeyTypographyProps } from '~/shared/theme/bey/typography';

export type BeyTextProps = TextProps & { variant?: BeyTextVariant; tone?: BeyColorRole };

/** Opt-in source typography; it does not alter the app's existing Text defaults. */
export const BeyText = forwardRef<React.ComponentRef<typeof Text>, BeyTextProps>(function BeyText(
  { variant = 'body1', tone = 'textPrimary', fontVariant, style, ...props },
  ref,
) {
  const theme = useTheme();
  const { style: webStyle, ...metrics } = getBeyTypographyProps(
    variant,
    Platform.OS === 'web',
    fontVariant,
  );
  return (
    <Text
      unstyled
      ref={ref}
      color={String(theme[beyColorKey(tone)]?.val ?? theme.color.val)}
      {...metrics}
      {...props}
      style={[webStyle, style]}
    />
  );
});
