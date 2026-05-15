import React, { ReactNode } from "react";
import Svg, {
    Defs,
    Rect,
    RadialGradient,
    Stop,
} from "react-native-svg";
import { View, useTheme, getTokens, getVariableValue } from "tamagui";

interface GlowCardProps {
    width?: number | string;
    height?: number | string;
    rounded?: number | string;
    gradientColor?: string;
    middleColor?: string;
    bgColor?: string;
    children?: ReactNode;
}

export default function GlowCard({
    width = 350,
    height = 400,
    rounded = 30,
    gradientColor = "#ffffff",
    middleColor,
    bgColor = "#050505",
    children,
}: GlowCardProps) {
    const theme = useTheme();

    // Helper to resolve color tokens
    const resolveColor = (color: string) => {
        if (color.startsWith("$")) {
            const tokenName = color.slice(1);
            if (theme[tokenName]) {
                return theme[tokenName].get();
            } else {
                const tokens = getTokens();
                const token = tokens.color[tokenName];
                if (token) {
                    return getVariableValue(token);
                }
            }
        }
        return color;
    };

    const resolvedGradientColor = resolveColor(gradientColor);
    const resolvedMiddleColor = resolveColor(middleColor || gradientColor);

    return (
        <View
            width={width}
            height={height}
            borderRadius={rounded}
            overflow="hidden"
            backgroundColor={bgColor}
        >
            <Svg
                width={width}
                height={height}
                style={{
                    position: "absolute",
                }}
            >
                <Defs>
                    <RadialGradient
                        id="grad"
                        cx="50%"
                        cy="50%"
                        r="80%"
                    >
                        {/* center */}
                        <Stop
                            offset="0%"
                            stopColor={resolvedGradientColor}
                            stopOpacity="0.02"
                        />

                        {/* middle */}
                        <Stop
                            offset="50%"
                            stopColor={resolvedMiddleColor}
                            stopOpacity="0.5"
                        />

                        {/* edges */}
                        <Stop
                            offset="100%"
                            stopColor={resolvedGradientColor}
                            stopOpacity="0.7"
                        />
                    </RadialGradient>
                </Defs>

                <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="url(#grad)"
                />
            </Svg>
            {/* Render children on top of the background */}
            <View style={{ flex: 1, zIndex: 1 }}>
                {children}
            </View>
        </View>
    );
}


