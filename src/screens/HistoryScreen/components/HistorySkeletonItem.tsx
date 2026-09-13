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
import { useTheme, Separator, YStack } from 'tamagui';

const ShimmerRect = ({
  width,
  height,
  borderRadius = 6,
  progress,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  progress: Animated.SharedValue<number>;
}) => {
  const theme = useTheme();
  const bg = theme.gray4?.val ?? '#333333';

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
    <YStack>
      <View style={styles.row}>
        {/* Left icon circle placeholder (matches TView 40x40 circle) */}
        <ShimmerRect width={40} height={40} borderRadius={20} progress={progress} />

        {/* Middle content — title only (subtitle removed) */}
        <View style={styles.middle}>
          <ShimmerRect
            width={index % 3 === 0 ? 120 : index % 3 === 1 ? 90 : 140}
            height={16}
            borderRadius={6}
            progress={progress}
          />
        </View>

        {/* Right — single primary amount placeholder */}
        <ShimmerRect width={72} height={20} borderRadius={6} progress={progress} />
      </View>

      {/* Matching Separator */}
      <Separator borderColor="$borderColor" opacity={0.3} />
    </YStack>
  );
};

/** A full skeleton section: date header + N rows */
export const HistorySkeletonSection: React.FC<{
  rows?: number;
  progress: Animated.SharedValue<number>;
}> = ({ rows = 3, progress }) => {
  return (
    <View style={styles.section}>
      {/* Date label placeholder */}
      <View style={{ paddingHorizontal: 4, paddingVertical: 8, marginTop: 12 }}>
        <ShimmerRect width={80} height={12} borderRadius={5} progress={progress} />
      </View>
      <View style={styles.card}>
        {Array.from({ length: rows }).map((_, i) => (
          <HistorySkeletonItem key={i} progress={progress} index={i} />
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
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'transparent',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
});
