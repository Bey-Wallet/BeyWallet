/**
 * SkeletonCard — shimmer loading placeholder for lazy-loaded sections.
 *
 * Renders a rounded card with animated gradient "shine" sweeping left-to-right.
 * Used as Suspense fallback on the HomeTabScreen so below-fold sections
 * feel snappy rather than showing empty space.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { YStack, XStack, View, useTheme } from 'tamagui';

interface SkeletonCardProps {
    /** Overall height of the card */
    height?: number;
    /** Number of shimmer rows inside the card (default 2) */
    rows?: number;
    /** Show a small circular element on the left (avatar placeholder) */
    showAvatar?: boolean;
    /** Border radius token (default $5) */
    rounded?: string;
}

export default function SkeletonCard({
    height = 100,
    rows = 2,
    showAvatar = false,
    rounded = '$5',
}: SkeletonCardProps) {
    const theme = useTheme();
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [shimmer]);

    const translateX = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 400],
    });

    const shimmerBg = theme.gray4?.val ?? '#2a2a2a';
    const shimmerHighlight = theme.gray6?.val ?? '#3a3a3a';

    return (
        <YStack
            width="100%"
            height={height}
            bg="$gray2"
            rounded={rounded as any}
            borderWidth={0.5}
            borderColor="$gray3"
            overflow="hidden"
            p="$3"
            gap="$3"
            justify="center"
        >
            {/* Shimmer overlay */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <View
                    width={120}
                    height="100%"
                    opacity={0.15}
                    style={{
                        backgroundColor: shimmerHighlight,
                        // Soft gradient effect via opacity
                    }}
                />
            </Animated.View>

            <XStack gap="$3" items="center">
                {showAvatar && (
                    <View
                        width={40}
                        height={40}
                        rounded="$3"
                        bg="$gray4"
                    />
                )}
                <YStack gap="$2" flex={1}>
                    {Array.from({ length: rows }).map((_, i) => (
                        <View
                            key={i}
                            height={i === 0 ? 16 : 12}
                            width={i === 0 ? '60%' : '40%'}
                            bg="$gray4"
                            rounded="$2"
                        />
                    ))}
                </YStack>
            </XStack>
        </YStack>
    );
}
