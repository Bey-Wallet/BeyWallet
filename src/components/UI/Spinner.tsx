import React, { useEffect } from 'react';
import { Loader, LoaderCircle } from '@tamagui/lucide-icons';
import { YStack, YStackProps, useTheme, variableToString } from 'tamagui';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation
} from 'react-native-reanimated';

export type SpinnerProps = Omit<YStackProps, 'children'> & {
    size?: number | 'small' | 'large' | 'xlarge' | 'xxlarge'
    color?: string
}

export const Spinner = (props: SpinnerProps) => {
    const { size = 'small', color: colorProp, ...stackProps } = props;
    const theme = useTheme();
    const rotation = useSharedValue(0);

    // Resolve color tokens
    let color = colorProp || theme.accentColor?.val || theme.color?.val;
    if (color && color.startsWith('$')) {
        color = variableToString(theme[color as keyof typeof theme]);
    }

    // Resolve size
    const iconSize = size === 'small' ? 20 : size === 'large' ? 40 : size === 'xlarge' ? 60 : size === 'xxlarge' ? 120 : size;

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, {
                duration: 1000,
                easing: Easing.linear,
            }),
            -1, // Infinite
            false // Don't reverse
        );
        return () => cancelAnimation(rotation);
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }],
        };
    });

    return (
        <YStack items="center" justify="center" {...stackProps}>
            <Animated.View style={animatedStyle}>
                <Loader size={iconSize} color={color} />
            </Animated.View>
        </YStack>
    );
};
