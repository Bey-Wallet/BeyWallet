import React, { useEffect } from 'react';
import { Loader } from '@tamagui/lucide-icons';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { YStack, YStackProps, useTheme, variableToString } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export type SpinnerProps = Omit<YStackProps, 'children'> & {
  size?: number | 'small' | 'large' | 'xlarge' | 'xxlarge';
  color?: string;
  reduceMotion?: boolean;
  strokeWidth?: number;
};

export const Spinner = (props: SpinnerProps) => {
  const { size = 'small', color: colorProp, reduceMotion, strokeWidth = 2, ...stackProps } = props;
  const systemReducedMotion = useReducedMotion();
  const isStatic = reduceMotion ?? systemReducedMotion;
  const theme = useTheme();
  const rotation = useSharedValue(0);

  // Resolve color tokens
  let color = colorProp || theme.accentColor?.val || theme.color?.val;
  if (color && color.startsWith('$')) {
    color = variableToString(theme[color as keyof typeof theme]);
  }

  // Resolve size
  const iconSize =
    size === 'small'
      ? 20
      : size === 'large'
        ? 40
        : size === 'xlarge'
          ? 60
          : size === 'xxlarge'
            ? 120
            : size;

  useEffect(() => {
    rotation.value = 0;
    if (isStatic) return;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1, // Infinite
      false, // Don't reverse
    );
    return () => cancelAnimation(rotation);
  }, [isStatic, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${isStatic ? 0 : rotation.value}deg` }],
    };
  });

  return (
    <YStack items="center" justify="center" {...stackProps}>
      <Animated.View
        style={[
          animatedStyle,
          { width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Loader size={iconSize} color={color} strokeWidth={strokeWidth} />
      </Animated.View>
    </YStack>
  );
};
