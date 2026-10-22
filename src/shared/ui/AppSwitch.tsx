import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Check } from '@tamagui/lucide-icons';
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

export type AppSwitchVariant = 'neutral' | 'branded';
export type AppSwitchEmphasis = 'primary' | 'secondary';

export type AppSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: AppSwitchVariant;
  emphasis?: AppSwitchEmphasis;
};

// Keep the switch proportions consistent with its short, eased transition.
export function AppSwitch({
  checked,
  onCheckedChange,
  accessibilityLabel,
  disabled = false,
  variant = 'neutral',
  emphasis = 'primary',
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
  const iconColor = secondary ? alternateColor : primaryColor;

  useEffect(() => {
    progress.value = reducedMotion
      ? checked
        ? 1
        : 0
      : withTiming(checked ? 1 : 0, {
          duration: 80,
          easing: Easing.inOut(Easing.quad),
        });
  }, [checked, progress, reducedMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 28 }],
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', onThumbColor]),
  }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

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
      minWidth={60}
      minHeight={48}
      items="center"
      justify="center"
      rounded={999}
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ opacity: 1 }}
      hoverStyle={{ opacity: 0.9 }}
    >
      <Animated.View pointerEvents="none" style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Animated.View style={iconStyle}>
            <Check size={14} color={iconColor} strokeWidth={2.5} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 60, height: 32, borderRadius: 16, padding: 4 },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
