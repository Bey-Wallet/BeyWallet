import React from 'react';
import { H1, Text, View } from 'tamagui';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    withRepeat,
} from 'react-native-reanimated';

const AnimatedH1 = Animated.createAnimatedComponent(H1);
const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedView = Animated.createAnimatedComponent(View);

interface BouncyAmountProps {
    value: string;
    fontSize: number;
    prefix?: string;
    suffix?: string;
    color?: string;
    cursorColor?: string;
}

export function BouncyAmount({
    value,
    fontSize,
    prefix = '',
    suffix = '',
    color = '$color',
    cursorColor = '$accent10',
}: BouncyAmountProps) {
    const scale = useSharedValue(1);
    const cursorOpacity = useSharedValue(1);

    // Snappier bounce animation that is quick and does not lag
    React.useEffect(() => {
        scale.value = 1.08;
        scale.value = withSpring(1, {
            damping: 10,
            stiffness: 400,
            mass: 0.5,
        });
    }, [value]);

    // Blinking cursor (flicker) loop using step-like timings
    React.useEffect(() => {
        cursorOpacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 0 }),
                withTiming(1, { duration: 500 }),
                withTiming(0, { duration: 0 }),
                withTiming(0, { duration: 500 })
            ),
            -1,
            false
        );
    }, []);

    const animatedAmountStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const cursorStyle = useAnimatedStyle(() => {
        return {
            opacity: cursorOpacity.value,
        };
    });

    return (
        <AnimatedH1
            fontSize={fontSize}
            fontVariant={['tabular-nums']}
            fontWeight="700"
            letterSpacing={-1}
            py="$2"
            color={color}
            text="center"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[{ maxWidth: '100%', overflow: 'hidden' }, animatedAmountStyle]}
        >
            {prefix}{value}{suffix}
           
        </AnimatedH1>
    );
}
