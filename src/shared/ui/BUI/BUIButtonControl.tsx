import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import {
  Button,
  Text,
  XStack,
  useTheme,
  getVariableValue,
  type TextProps,
  type ButtonProps,
  type GetRef,
} from 'tamagui';
import { buiButtonSizes } from './theme';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import {
  appBorders,
  appButtonSizes,
  appButtonStates,
  appDimensions,
  appSpacing,
} from '~/shared/theme/appearance';

export type AppButtonVariant = 'default' | 'critical' | 'warning';
export type AppButtonEmphasis = 'primary' | 'secondary' | 'ghost' | 'text';
export type AppButtonSize = keyof typeof appButtonSizes;
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
  /** Optional accessible status announced while the centered loader is shown. */
  loadingText?: string;
  iconAfter?: AppButtonIcon;
  fullWidth?: boolean;
  /** For previewing accessibility text sizes; system font scaling remains enabled. */
  labelFontSize?: number;
  /** Custom foreground for background-free text actions. */
  textColor?: TextProps['color'];
  /** Override glyph size without changing the button's touch target. */
  iconSize?: number;
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

type BUIButtonControlProps = AppButtonProps & {
  /** Explicit palette for the catalog; wallet callers resolve their active Tamagui theme. */
  paletteOverride?: readonly [string, string, string, string];
  highlighted?: boolean;
};

export const BUIButtonControl = forwardRef<GetRef<typeof Button>, BUIButtonControlProps>(
  function BUIButtonControl(
    {
      children,
      variant = 'default',
      emphasis = 'primary',
      size: requestedSize,
      loading = false,
      disabled = false,
      loadingText,
      icon,
      iconAfter,
      iconOnly = false,
      shape = 'rounded',
      fullWidth,
      paletteOverride,
      highlighted = false,
      labelFontSize,
      textColor,
      iconSize: requestedIconSize,
      density = 'regular',
      onPress,
      accessibilityState,
      accessibilityLabel,
      width,
      ...props
    },
    ref,
  ) {
    const size = requestedSize ?? (iconOnly ? 'medium' : 'large');
    const theme = useTheme();
    const reducedMotion = useReducedMotion();
    const token = (key: string) => String(theme[key as keyof typeof theme]?.val);
    const prefix = `button${variant[0].toUpperCase()}${variant.slice(1)}`;
    const transparent = emphasis === 'ghost' || emphasis === 'text';
    const textOnly = emphasis === 'text';
    // Loading retains the enabled palette, including when both flags are set.
    const muted = disabled && !loading;
    const level = emphasis === 'primary' ? 'Primary' : 'Secondary';
    const background = paletteOverride
      ? paletteOverride[muted ? 1 : highlighted ? 2 : 0]
      : muted
        ? token(level === 'Primary' ? 'buttonDisabled' : 'buttonSecondaryDisabled')
        : token(`${prefix}${level}`);
    const customColor =
      textOnly && textColor != null
        ? typeof textColor === 'string' && textColor.startsWith('$')
          ? token(textColor.slice(1))
          : String(getVariableValue(textColor))
        : undefined;
    const color =
      customColor ??
      paletteOverride?.[3] ??
      token(
        muted && !textOnly
          ? level === 'Primary'
            ? 'buttonDisabledText'
            : 'buttonSecondaryDisabledText'
          : `${prefix}${transparent ? 'Text' : `${level}Text`}`,
      );
    const blocked = disabled || loading;
    const ghostNeutral = emphasis === 'ghost' && variant === 'default';
    const interactionBackground = (state: 'Hover' | 'Press') =>
      paletteOverride
        ? paletteOverride[2]
        : ghostNeutral
          ? token('buttonGhostHighlighted')
          : token(`${prefix}${level}${state}`);
    const { height: minHeight, icon: regularIconSize } = appButtonSizes[size];
    const spec = buiButtonSizes[size === 'large' || size === 'medium' ? size : 'small'];
    const resolvedFontSize = Math.round(labelFontSize ?? spec.fontSize);
    const fillWidth =
      fullWidth ??
      (!iconOnly && !transparent && size === 'large' && width == null && props.flex == null);
    const compact = iconOnly && density === 'compact';
    const iconSize = requestedIconSize ?? regularIconSize;
    const hitPadding = Math.max(0, (appDimensions.touchTarget - minHeight) / 2);

    return (
      <Button
        unstyled
        group
        {...props}
        ref={ref}
        accessibilityRole={props.accessibilityRole ?? (props.role === 'link' ? 'link' : 'button')}
        accessibilityLabel={
          loading
            ? (loadingText ?? accessibilityLabel ?? children)
            : (accessibilityLabel ?? children)
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
        width={fillWidth ? '100%' : (width ?? (iconOnly ? minHeight : undefined))}
        minWidth={iconOnly ? minHeight : textOnly ? appDimensions.touchTarget : undefined}
        minHeight={minHeight}
        height="auto"
        position="relative"
        hitSlop={{ top: hitPadding, bottom: hitPadding, left: hitPadding, right: hitPadding }}
        rounded={shape === 'circular' ? minHeight / 2 : spec.radius}
        px={
          iconOnly
            ? compact
              ? appSpacing.small
              : 0
            : textOnly
              ? appSpacing.compact
              : appSpacing.page
        }
        py={compact ? appSpacing.small : appSpacing.compact}
        flexDirection="row"
        items="center"
        justify="center"
        gap={appSpacing.compact}
        backgroundColor={
          transparent
            ? highlighted && !textOnly
              ? interactionBackground('Press')
              : 'transparent'
            : background
        }
        opacity={muted && textOnly ? appButtonStates.disabledTextOpacity : 1}
        cursor={blocked ? 'default' : 'pointer'}
        hoverStyle={
          blocked
            ? {}
            : {
                backgroundColor: textOnly ? 'transparent' : interactionBackground('Hover'),
                ...(textOnly ? { opacity: appButtonStates.hoverOpacity } : {}),
              }
        }
        pressStyle={
          blocked
            ? {}
            : {
                backgroundColor: textOnly ? 'transparent' : interactionBackground('Press'),
                scale: reducedMotion || textOnly ? 1 : appButtonStates.pressedScale,
                ...(textOnly ? { opacity: appButtonStates.pressOpacity } : {}),
              }
        }
        focusVisibleStyle={{
          outlineColor: token('buttonFocus'),
          outlineWidth: appBorders.focus,
          outlineOffset: appBorders.focusOffset,
          outlineStyle: 'solid',
        }}
      >
        <XStack
          items="center"
          justify="center"
          gap={appSpacing.compact}
          flexShrink={1}
          opacity={loading ? 0 : 1}
          aria-hidden={loading || undefined}
          accessibilityElementsHidden={loading}
          importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}
        >
          {icon ? (
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
              {!loading && renderIcon(icon, { size: iconSize, color })}
            </XStack>
          ) : null}
          {!iconOnly && (
            <Text
              fontFamily="$body"
              fontWeight="500"
              fontSize={resolvedFontSize}
              lineHeight={Math.round(resolvedFontSize * 1.4)}
              letterSpacing={resolvedFontSize * 0.005}
              color={color}
              flexShrink={1}
              textAlign="center"
              textDecorationLine="none"
              {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
            >
              {children}
            </Text>
          )}
          {!iconOnly && iconAfter ? (
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
              {!loading && renderIcon(iconAfter, { size: iconSize, color })}
            </XStack>
          ) : null}
        </XStack>
        {loading && (
          <XStack
            position="absolute"
            inset={0}
            items="center"
            justify="center"
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Spinner
              size={iconSize}
              width={iconSize}
              height={iconSize}
              color={color}
              reduceMotion={reducedMotion}
            />
          </XStack>
        )}
      </Button>
    );
  },
);
