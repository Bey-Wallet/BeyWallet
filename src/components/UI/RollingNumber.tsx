import React, { useEffect } from "react";
import { TextStyle, View, ViewStyle } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    withDelay,
} from "react-native-reanimated";
import { Text } from "tamagui";

interface RollingDigitProps {
    digit: string | number;
    height: number;
    width?: number;
    color?: any;
    fontWeight?: any;
    fontFamily?: string;
    fontSize?: number;
    index: number;
    letterSpacing?: number;
    duration?: number;
    opacity?: number;
}

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const RollingDigit = ({
    digit,
    height,
    color,
    fontWeight,
    fontFamily,
    fontSize,
    index,
    letterSpacing = 0,
    duration = 800,
    opacity = 1,
}: RollingDigitProps) => {
    const parsedDigit = parseInt(digit as string, 10);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (!isNaN(parsedDigit)) {
            translateY.value = withDelay(
                index * 50,
                withTiming(-parsedDigit * height, {
                    duration: duration,
                    easing: Easing.out(Easing.exp),
                })
            );
        } else {
            translateY.value = 0;
        }
    }, [parsedDigit, height, index, duration]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <View style={{ height, overflow: "hidden", marginRight: letterSpacing, opacity }}>
            <Animated.View style={animatedStyle}>
                {NUMBERS.map((num) => (
                    <View
                        key={num}
                        style={{
                            height,
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <Text
                            color={color}
                            fontWeight={fontWeight}

                            fontSize={fontSize}
                            lineHeight={height}
                            text="center"
                            fontVariant={['tabular-nums']}
                        >
                            {num}
                        </Text>
                    </View>
                ))}
            </Animated.View>
        </View>
    );
};

export interface RollingNumberProps {
    value?: number | string;
    children?: number | string;
    fontSize?: number;
    color?: any;
    fontWeight?: any;
    fontFamily?: string;
    style?: ViewStyle;
    letterSpacing?: number;
    lineHeight?: number;
    trigger?: any;
    prefix?: string;
    suffix?: string;
    decimalOpacity?: number;
    precision?: number;
    showDecimals?: boolean;
}

export const RollingNumber = ({
    value,
    children,
    fontSize = 40,
    color = "black",
    fontWeight = "400",
    fontFamily,
    style,
    letterSpacing = 0,
    lineHeight,
    trigger,
    prefix = "",
    suffix = "",
    decimalOpacity = 0.5,
    precision = 2,
    showDecimals = true,
}: RollingNumberProps) => {
    // Current display value
    const displayValue = children !== undefined ? children : value;

    // Build the string to display
    let formattedValue = "";

    if (typeof displayValue === "number") {
        const finalPrecision = showDecimals ? precision : 0;
        formattedValue = displayValue.toLocaleString(undefined, {
            minimumFractionDigits: finalPrecision,
            maximumFractionDigits: finalPrecision,
        });
    } else {
        formattedValue = displayValue?.toString() || "";
    }

    const valueStr = prefix + formattedValue + suffix;
    const itemHeight = lineHeight || fontSize * 1.1;

    // Track if we've passed the decimal point
    let isDecimal = false;

    return (
        <View style={[{ flexDirection: "row", alignItems: "baseline" }, style]} key={trigger}>
            {valueStr.split("").map((char, index) => {
                if (char === "." || char === ",") {
                    // Check if this comma is a decimal separator (some locales use , for decimal)
                    // But usually in English formatting it's a dot. 
                    // Let's assume '.' is decimal for simplicity or check position.
                    if (char === ".") isDecimal = true;
                }

                const currentOpacity = isDecimal ? decimalOpacity : 1;

                if (/[0-9]/.test(char)) {
                    return (
                        <RollingDigit
                            key={`digit-${index}`}
                            digit={char}
                            height={itemHeight}
                            index={index}
                            color={color}
                            fontWeight={fontWeight}

                            fontSize={fontSize}
                            letterSpacing={letterSpacing}
                            opacity={currentOpacity}
                        />
                    );
                } else {
                    return (
                        <View
                            key={`char-${index}`}
                            style={{
                                height: itemHeight,
                                justifycontent: "center",
                                alignItems: "center",
                                marginRight: letterSpacing,
                                opacity: currentOpacity
                            }}
                        >
                            <Text
                                color={color}
                                fontWeight={fontWeight}
                                fontSize={fontSize}
                                lineHeight={itemHeight}

                                fontVariant={['tabular-nums']}
                            >
                                {char}
                            </Text>
                        </View>
                    );
                }
            })}
        </View>
    );
};
