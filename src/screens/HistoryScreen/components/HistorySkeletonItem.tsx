/**
 * HistorySkeletonItem — an animated shimmer placeholder for a history row.
 * Uses react-native-reanimated's withRepeat + withTiming for a pure-JS shimmer
 * that works on both iOS and Android without native driver issues.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { useTheme } from 'tamagui';

const ShimmerRect = ({
    width,
    height,
    borderRadius = 6,
    progress,
    delay = 0,
}: {
    width: number | string;
    height: number;
    borderRadius?: number;
    progress: Animated.SharedValue<number>;
    delay?: number;
}) => {
    const theme = useTheme();
    const bg = theme.gray4?.val ?? '#333333';
    const highlight = theme.gray6?.val ?? '#3a3a3a';

    const animStyle = useAnimatedStyle(() => {
        const opacity = interpolate(progress.value, [0, 0.5, 1], [0.5, 1, 0.5]);
        return { opacity };
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: bg,
                },
                animStyle,
            ]}
        />
    );
};

interface HistorySkeletonItemProps {
    progress: Animated.SharedValue<number>;
    index?: number;
}

export const HistorySkeletonItem: React.FC<HistorySkeletonItemProps> = ({
    progress,
    index = 0,
}) => {
    return (
        <View style={[styles.row]}>
            {/* Left icon circle */}
            <ShimmerRect width={38} height={38} borderRadius={12} progress={progress} />

            {/* Middle content — title + subtitle */}
            <View style={styles.middle}>
                <ShimmerRect
                    width={index % 3 === 0 ? 140 : index % 3 === 1 ? 110 : 160}
                    height={14}
                    borderRadius={6}
                    progress={progress}
                />
                <View style={{ marginTop: 6 }}>
                    <ShimmerRect
                        width={index % 2 === 0 ? 90 : 70}
                        height={11}
                        borderRadius={5}
                        progress={progress}
                    />
                </View>
            </View>

            {/* Right — amount */}
            <ShimmerRect width={64} height={16} borderRadius={6} progress={progress} />
        </View>
    );
};

/** A full skeleton section: date header + N rows */
export const HistorySkeletonSection: React.FC<{
    rows?: number;
    progress: Animated.SharedValue<number>;
}> = ({ rows = 3, progress }) => {
    const theme = useTheme();
    return (
        <View style={styles.section}>
            {/* Date label */}
            <View style={{ paddingHorizontal: 4, paddingVertical: 8, marginTop: 12 }}>
                <ShimmerRect width={80} height={12} borderRadius={5} progress={progress} />
            </View>
            <View style={[styles.card, { backgroundColor: theme.gray3?.val ?? '#1f1f1f', borderRadius: 16 }]}>
                {Array.from({ length: rows }).map((_, i) => (
                    <React.Fragment key={i}>
                        <HistorySkeletonItem progress={progress} index={i} />
                        {i < rows - 1 && (
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: theme.borderColor?.val ?? 'rgba(128,128,128,0.15)',
                                    opacity: 0.5,
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
};

/** Full-page skeleton: 3 fake sections */
export const HistoryPageSkeleton: React.FC = () => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, []);

    return (
        <View style={styles.page}>
            <HistorySkeletonSection rows={4} progress={progress} />
            <HistorySkeletonSection rows={3} progress={progress} />
            <HistorySkeletonSection rows={2} progress={progress} />
        </View>
    );
};

const styles = StyleSheet.create({
    page: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    section: {
        marginTop: 24,
        gap: 8,
    },
    card: {
        marginTop: 10,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: 'transparent',
    },
    middle: {
        flex: 1,
        gap: 0,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(128,128,128,0.15)',
        marginLeft: 66,
    },
});
