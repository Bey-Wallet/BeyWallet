import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, useThemeName } from 'tamagui';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { AppPressable } from '~/shared/ui/AppPressable';
import { appSpacing } from '~/shared/theme/appearance';

export type AppSwitchVariant = 'neutral' | 'branded';
export type AppSwitchEmphasis = 'primary' | 'secondary';

export type AppSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: AppSwitchVariant;
  emphasis?: AppSwitchEmphasis;
  children?: React.ReactNode;
};

// Compact iOS-style proportions with a short, UI-thread transition.
export function AppSwitch({
  checked,
  onCheckedChange,
  accessibilityLabel,
  disabled = false,
  variant = 'neutral',
  emphasis = 'primary',
  children,
}: AppSwitchProps) {
  const dark = useThemeName().startsWith('dark');
  const theme = useTheme();
  const primaryColor = String(theme.accentColor.val);
  const alternateColor = String(theme.onAccent.val);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(checked ? 1 : 0);
  const branded = variant === 'branded';
  const secondary = emphasis === 'secondary';
  const foreground = primaryColor;
  const offColor = dark ? 'rgba(255,255,255,0.38)' : 'rgba(19,19,19,0.35)';
  const onColor = secondary
    ? String(theme.buttonDefaultSecondary?.val ?? theme.gray3.val)
    : branded
      ? primaryColor
      : foreground;
  const onThumbColor = secondary ? (branded ? primaryColor : foreground) : alternateColor;

  useEffect(() => {
    progress.value = reducedMotion
      ? checked
        ? 1
        : 0
      : withTiming(checked ? 1 : 0, {
          duration: 140,
          easing: Easing.inOut(Easing.quad),
        });
  }, [checked, progress, reducedMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', onThumbColor]),
  }));

  return (
    <AppPressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation();
        onCheckedChange(!checked);
      }}
      minWidth={52}
      minHeight={48}
      width={children ? '100%' : undefined}
      px={children ? appSpacing.page : 0}
      py={children ? appSpacing.compact : 0}
      flexDirection="row"
      gap={children ? appSpacing.gap : 0}
      items="center"
      justify={children ? 'space-between' : 'center'}
      rounded={children ? 0 : 999}
      opacity={disabled ? 0.5 : 1}
      pressStyle={children ? { bg: '$gray4' } : { opacity: 1 }}
      hoverStyle={children ? { bg: '$gray3' } : { opacity: 0.9 }}
    >
      {children}
      <Animated.View pointerEvents="none" style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});
