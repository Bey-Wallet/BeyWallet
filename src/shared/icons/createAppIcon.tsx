import React, { memo } from 'react';
import { getTokens, useTheme } from 'tamagui';
import type { Icon, IconProps } from 'phosphor-react-native';
import type { SvgProps } from 'react-native-svg';

export type AppIconProps = Omit<SvgProps, 'color' | 'style' | 'strokeWidth'> &
  Omit<IconProps, 'color' | 'size'> & {
    color?: string;
    size?: number | string;
    /** Compatibility prop: Phosphor uses preset weights; app icons default to bold. */
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
    flexShrink?: number;
  };

/** Resolve app theme tokens before passing color and size to native SVG icons. */
export function createAppIcon(Component: Icon, name: string) {
  const AppIcon = memo(function AppIcon({
    color = '$color',
    size = 24,
    weight,
    strokeWidth,
    absoluteStrokeWidth,
    flexShrink,
    fill,
    style,
    ...props
  }: AppIconProps) {
    const theme = useTheme();
    const resolvedColor = color.startsWith('$')
      ? (theme[color.slice(1)]?.val ?? theme.color?.val ?? 'currentColor')
      : color;
    const resolvedSize =
      typeof size === 'number'
        ? size
        : size.startsWith('$')
          ? (getTokens().size[size as keyof ReturnType<typeof getTokens>['size']]?.val ?? 24)
          : Number(size) || 24;
    return (
      <Component
        {...props}
        color={resolvedColor}
        size={resolvedSize}
        style={flexShrink === undefined ? style : [style, { flexShrink }]}
        weight={weight ?? (fill && fill !== 'none' ? 'fill' : 'bold')}
      />
    );
  });
  AppIcon.displayName = name;
  return AppIcon;
}
