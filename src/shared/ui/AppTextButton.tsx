import React, { forwardRef } from 'react';
import type { TextProps } from 'tamagui';
import { AppButton, type AppButtonProps } from './AppButton';

export type AppTextButtonProps = Pick<
  AppButtonProps,
  'onPress' | 'disabled' | 'accessibilityLabel' | 'testID' | 'alignSelf' | 'maxWidth'
> & {
  children: string;
  color?: TextProps['color'];
};

/** Convenience wrapper: one shared implementation for background-free text actions. */
export const AppTextButton = forwardRef<React.ComponentRef<typeof AppButton>, AppTextButtonProps>(
  function AppTextButton({ children, color = '$color', ...props }, ref) {
    return (
      <AppButton
        {...props}
        ref={ref}
        emphasis="text"
        size="medium"
        labelFontSize={14}
        textColor={color}
      >
        {children}
      </AppButton>
    );
  },
);
