import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { Theme, usePropsAndStyle, useTheme, type YStackProps } from 'tamagui';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

type NativeEvents =
  | 'onPress'
  | 'onLongPress'
  | 'onPressIn'
  | 'onPressOut'
  | 'onHoverIn'
  | 'onHoverOut'
  | 'onFocus'
  | 'onBlur';
export type AppPressableProps = Omit<YStackProps, NativeEvents | 'children'> &
  Pick<PressableProps, NativeEvents> & { children: React.ReactNode };

/** Interaction boundary for selectors, chips, keys, and rows with their own layout. */
export const AppPressable = forwardRef<React.ElementRef<typeof Pressable>, AppPressableProps>(
  function AppPressable(
    {
      children,
      disabled,
      onPress,
      onLongPress,
      onPressIn,
      onPressOut,
      onHoverIn,
      onHoverOut,
      onFocus,
      onBlur,
      pressStyle = { opacity: 0.8 },
      hoverStyle = { opacity: 0.9 },
      focusVisibleStyle,
      animation: _animation,
      ...props
    },
    ref,
  ) {
    const theme = useTheme();
    const reducedMotion = useReducedMotion();
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focusVisible, setFocusVisible] = useState(false);
    // Resolve styles without installing a second press responder around Pressable.
    const [nativeProps, style] = usePropsAndStyle({
      backgroundColor: 'transparent',
      borderWidth: 0,
      minWidth: 0,
      cursor: disabled ? 'default' : 'pointer',
      ...props,
      disabled,
      ...(!disabled && hovered ? hoverStyle : {}),
      ...(!disabled && pressed ? { ...pressStyle, ...(reducedMotion ? { scale: 1 } : {}) } : {}),
      ...(!disabled && focusVisible
        ? {
            ...focusVisibleStyle,
            outlineColor: String(theme.blue10.val),
            outlineWidth: 2,
            outlineOffset: 2,
            outlineStyle: 'solid',
          }
        : {}),
    });
    const minHeight = props.minHeight;
    const content = (
      <Pressable
        {...(nativeProps as PressableProps)}
        ref={ref}
        style={[
          style as ViewStyle,
          props.style as ViewStyle,
          !disabled && focusVisible ? { outlineOffset: 2 } : undefined,
        ]}
        accessibilityRole={props.accessibilityRole ?? 'button'}
        {...(Platform.OS === 'web'
          ? {
              accessibilityState: undefined,
              'aria-disabled': !!disabled,
              'aria-busy': props.accessibilityState?.busy,
              'aria-selected': props['aria-selected'] ?? props.accessibilityState?.selected,
              'aria-expanded': props['aria-expanded'] ?? props.accessibilityState?.expanded,
              'aria-checked': props['aria-checked'] ?? props.accessibilityState?.checked,
            }
          : { accessibilityState: { ...props.accessibilityState, disabled: !!disabled } })}
        disabled={disabled}
        hitSlop={
          props.hitSlop ??
          (typeof minHeight === 'number' ? Math.max(0, (48 - minHeight) / 2) : undefined)
        }
        onPress={(event) => {
          if (!disabled) onPress?.(event);
        }}
        onLongPress={
          onLongPress
            ? (event) => {
                if (!disabled) onLongPress(event);
              }
            : undefined
        }
        onPressIn={(event) => {
          setPressed(true);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          onPressOut?.(event);
        }}
        onHoverIn={(event) => {
          setHovered(true);
          onHoverIn?.(event);
        }}
        onHoverOut={(event) => {
          setHovered(false);
          onHoverOut?.(event);
        }}
        onFocus={(event) => {
          const target = event.currentTarget as unknown as {
            matches?: (selector: string) => boolean;
          };
          setFocusVisible(Platform.OS !== 'web' || (target.matches?.(':focus-visible') ?? true));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocusVisible(false);
          onBlur?.(event);
        }}
      >
        {children}
      </Pressable>
    );
    return props.theme ? <Theme name={props.theme}>{content}</Theme> : content;
  },
);
