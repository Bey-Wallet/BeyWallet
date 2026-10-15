import React, { forwardRef } from 'react';
import { Button, Text, XStack, useTheme, type ButtonProps, type GetRef } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

export type AppButtonVariant = 'default' | 'branded' | 'critical' | 'warning';
export type AppButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'text-only';
export type AppButtonSize = 'xxsmall' | 'xsmall' | 'small' | 'medium' | 'large';
type Icon = React.ComponentType<{ size: number; color: string }>;

export type AppButtonProps = Omit<
  ButtonProps,
  'children' | 'variant' | 'size' | 'icon' | 'iconAfter' | 'disabled'
> & {
  children: string;
  variant?: AppButtonVariant;
  emphasis?: AppButtonEmphasis;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Optional label shown beside the spinner while loading. */
  loadingText?: string;
  icon?: Icon;
  iconAfter?: Icon;
  fullWidth?: boolean;
  /** For previewing accessibility text sizes; system font scaling remains enabled. */
  labelFontSize?: number;
};

const sizes = {
  xxsmall: [32, 12, 14, 8],
  xsmall: [36, 13, 16, 10],
  small: [40, 14, 18, 12],
  medium: [48, 16, 20, 16],
  large: [56, 18, 24, 20],
} as const;

export const AppButton = forwardRef<GetRef<typeof Button>, AppButtonProps>(function AppButton(
  {
    children,
    variant = 'branded',
    emphasis = 'primary',
    size = 'medium',
    loading = false,
    disabled = false,
    loadingText,
    icon: LeadingIcon,
    iconAfter: TrailingIcon,
    fullWidth = false,
    labelFontSize,
    onPress,
    accessibilityState,
    accessibilityLabel,
    ...props
  },
  ref,
) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const token = (key: string) =>
    String(theme[(key === 'buttonBrandedPrimary' ? 'blue10' : key) as keyof typeof theme]?.val);
  const prefix = `button${variant[0].toUpperCase()}${variant.slice(1)}`;
  const transparent = emphasis === 'tertiary' || emphasis === 'text-only';
  const textOnly = emphasis === 'text-only';
  // Loading retains the enabled palette, including when both flags are set.
  const muted = disabled && !loading;
  const level = emphasis === 'primary' ? 'Primary' : 'Secondary';
  const background = muted ? token('buttonDisabled') : token(`${prefix}${level}`);
  const color = token(
    muted ? 'buttonDisabledText' : `${prefix}${transparent ? 'Text' : `${level}Text`}`,
  );
  const blocked = disabled || loading;
  const [minHeight, fontSize, iconSize, radius] = sizes[size];
  const hitPadding = Math.max(0, (48 - minHeight) / 2);

  return (
    <Button
      unstyled
      group
      {...props}
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={
        loading ? (loadingText ?? accessibilityLabel ?? children) : (accessibilityLabel ?? children)
      }
      accessibilityState={{ ...accessibilityState, disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={(event) => {
        if (!blocked) onPress?.(event);
      }}
      width={fullWidth ? '100%' : undefined}
      minHeight={minHeight}
      height="auto"
      position="relative"
      hitSlop={{ top: hitPadding, bottom: hitPadding, left: hitPadding, right: hitPadding }}
      rounded={radius}
      px={16}
      py={8}
      flexDirection="row"
      items="center"
      justify="center"
      gap={8}
      backgroundColor={transparent ? 'transparent' : background}
      cursor={blocked ? 'default' : 'pointer'}
      hoverStyle={
        blocked
          ? {}
          : { backgroundColor: textOnly ? 'transparent' : token(`${prefix}${level}Hover`) }
      }
      pressStyle={
        blocked
          ? {}
          : {
              backgroundColor: textOnly ? 'transparent' : token(`${prefix}${level}Press`),
              scale: reducedMotion || textOnly ? 1 : 0.98,
            }
      }
      focusVisibleStyle={{
        outlineColor: token('buttonFocus'),
        outlineWidth: 2,
        outlineOffset: 2,
        outlineStyle: 'solid',
      }}
    >
      <XStack items="center" justify="center" gap={8} flexShrink={1}>
        {loading || LeadingIcon ? (
          <XStack
            width={iconSize}
            height={iconSize}
            flexShrink={0}
            items="center"
            justify="center"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {loading ? (
              <Spinner
                size={iconSize}
                width={iconSize}
                height={iconSize}
                color={color}
                reduceMotion={reducedMotion}
              />
            ) : LeadingIcon ? (
              <LeadingIcon size={iconSize} color={color} />
            ) : null}
          </XStack>
        ) : null}
        <Text
          fontFamily="$body"
          fontWeight="600"
          fontSize={labelFontSize ?? fontSize}
          lineHeight={(labelFontSize ?? fontSize) * 1.4}
          color={color}
          flexShrink={1}
          textAlign="center"
          includeFontPadding={false}
          $group-hover={
            blocked
              ? {}
              : textOnly
                ? { textDecorationLine: 'underline' }
                : emphasis === 'tertiary' && variant === 'branded'
                  ? { color: token('buttonBrandedTextHover') }
                  : {}
          }
          $group-press={
            blocked
              ? {}
              : textOnly
                ? { textDecorationLine: 'underline' }
                : emphasis === 'tertiary' && variant === 'branded'
                  ? { color: token('buttonBrandedTextPress') }
                  : {}
          }
        >
          {loading ? (loadingText ?? children) : children}
        </Text>
        {!loading && TrailingIcon ? (
          <XStack
            width={iconSize}
            height={iconSize}
            flexShrink={0}
            items="center"
            justify="center"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <TrailingIcon size={iconSize} color={color} />
          </XStack>
        ) : null}
      </XStack>
    </Button>
  );
});
