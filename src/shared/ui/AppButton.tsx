import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import { Button, Text, XStack, useTheme, type ButtonProps, type GetRef } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

export type AppButtonVariant = 'default' | 'branded' | 'critical' | 'warning';
export type AppButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'text-only';
export type AppButtonSize = 'xxsmall' | 'xsmall' | 'small' | 'medium' | 'large';
type IconProps = { size: number; color: string };
export type AppButtonIcon =
  React.ComponentType<IconProps> | React.ReactElement<Partial<IconProps>> | null;

type AppButtonBaseProps = Omit<
  ButtonProps,
  'children' | 'variant' | 'size' | 'icon' | 'iconAfter' | 'disabled'
> & {
  variant?: AppButtonVariant;
  emphasis?: AppButtonEmphasis;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Optional label shown beside the spinner while loading. */
  loadingText?: string;
  iconAfter?: AppButtonIcon;
  fullWidth?: boolean;
  /** For previewing accessibility text sizes; system font scaling remains enabled. */
  labelFontSize?: number;
};

export type AppButtonProps = AppButtonBaseProps &
  (
    | {
        iconOnly?: false;
        children: string;
        icon?: AppButtonIcon;
        shape?: 'rounded';
        density?: never;
      }
    | {
        iconOnly: true;
        children?: never;
        icon: NonNullable<AppButtonIcon>;
        accessibilityLabel: string;
        shape?: 'rounded' | 'circular';
        density?: 'regular' | 'compact';
      }
  );

function renderIcon(icon: AppButtonIcon | undefined, props: IconProps) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return React.cloneElement(icon, props);
  const IconComponent = icon as React.ComponentType<IconProps>;
  return <IconComponent {...props} />;
}

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
    icon,
    iconAfter,
    iconOnly = false,
    shape = 'rounded',
    fullWidth = false,
    labelFontSize,
    density = 'regular',
    onPress,
    accessibilityState,
    accessibilityLabel,
    width,
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
  const [minHeight, fontSize, regularIconSize, radius] = sizes[size];
  const compact = iconOnly && density === 'compact';
  const iconSize = compact
    ? { xxsmall: 20, xsmall: 24, small: 28, medium: 32, large: 36 }[size]
    : regularIconSize;
  const hitPadding = Math.max(0, (48 - minHeight) / 2);

  return (
    <Button
      unstyled
      group
      {...props}
      ref={ref}
      accessibilityRole={props.accessibilityRole ?? (props.role === 'link' ? 'link' : 'button')}
      accessibilityLabel={
        loading ? (loadingText ?? accessibilityLabel ?? children) : (accessibilityLabel ?? children)
      }
      {...(Platform.OS === 'web'
        ? {
            'aria-disabled': blocked,
            'aria-busy': loading,
            'aria-selected': props['aria-selected'] ?? accessibilityState?.selected,
            'aria-expanded': props['aria-expanded'] ?? accessibilityState?.expanded,
            'aria-checked': props['aria-checked'] ?? accessibilityState?.checked,
          }
        : { accessibilityState: { ...accessibilityState, disabled: blocked, busy: loading } })}
      disabled={blocked}
      onPress={(event) => {
        if (!blocked) onPress?.(event);
      }}
      width={fullWidth ? '100%' : (width ?? (iconOnly ? minHeight : undefined))}
      minWidth={iconOnly ? minHeight : undefined}
      minHeight={minHeight}
      height="auto"
      position="relative"
      hitSlop={{ top: hitPadding, bottom: hitPadding, left: hitPadding, right: hitPadding }}
      rounded={shape === 'circular' ? minHeight / 2 : radius}
      px={iconOnly ? (compact ? 4 : 0) : 16}
      py={compact ? 4 : 8}
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
        {loading || icon ? (
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
            ) : (
              renderIcon(icon, { size: iconSize, color })
            )}
          </XStack>
        ) : null}
        {!iconOnly && (
          <Text
            fontFamily="$body"
            fontWeight="600"
            fontSize={labelFontSize ?? fontSize}
            lineHeight={(labelFontSize ?? fontSize) * 1.4}
            color={color}
            flexShrink={1}
            textAlign="center"
            {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
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
        )}
        {!loading && !iconOnly && iconAfter ? (
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
            {renderIcon(iconAfter, { size: iconSize, color })}
          </XStack>
        ) : null}
      </XStack>
    </Button>
  );
});
