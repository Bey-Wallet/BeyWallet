import React, { forwardRef } from 'react';
import { Text, type TextProps } from 'tamagui';
import { AppPressable, type AppPressableProps } from './AppPressable';

export type AppTextButtonProps = Pick<
  AppPressableProps,
  'onPress' | 'disabled' | 'accessibilityLabel' | 'testID' | 'alignSelf' | 'maxWidth'
> & {
  children: string;
  color?: TextProps['color'];
};

/** A text action with button semantics and no background in any interaction state. */
export const AppTextButton = forwardRef<React.ElementRef<typeof AppPressable>, AppTextButtonProps>(
  function AppTextButton({ children, color = '$color', disabled = false, ...props }, ref) {
    return (
      <AppPressable
        {...props}
        ref={ref}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? children}
        minHeight={48}
        minWidth={48}
        px="$2"
        py="$2"
        items="center"
        justify="center"
        bg="transparent"
        opacity={disabled ? 0.4 : 1}
        pressStyle={{ opacity: 0.65 }}
        hoverStyle={{ opacity: 0.85 }}
        flexShrink={0}
      >
        <Text
          fontFamily="$body"
          fontSize={14}
          lineHeight={20}
          fontWeight="600"
          color={color}
          textAlign="center"
          textDecorationLine="none"
          flexShrink={1}
        >
          {children}
        </Text>
      </AppPressable>
    );
  },
);
