/**
 * HistorySkeletonItem — an animated shimmer placeholder for a history row.
 * Uses react-native-reanimated's withRepeat + withTiming for a pure-JS shimmer
 * that works on both iOS and Android without native driver issues.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, YStack } from 'tamagui';

const ShimmerRect = ({
  width,
  height,
  borderRadius = 6,
  progress,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  progress: SharedValue<number>;
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
  progress: SharedValue<number>;
  index?: number;
}

export const HistorySkeletonItem: React.FC<HistorySkeletonItemProps> = ({
  progress,
  index = 0,
}) => {
  return (
    <YStack bg="transparent" rounded="$6" overflow="hidden" mb={6}>
      <View style={styles.row}>
        {/* Leading icon */}
        <ShimmerRect width={44} height={44} borderRadius={22} progress={progress} />

        {/* Title and time */}
        <View style={styles.middle}>
          <ShimmerRect
            width={index % 3 === 0 ? 120 : index % 3 === 1 ? 90 : 140}
            height={14}
            borderRadius={6}
            progress={progress}
          />
          <ShimmerRect width={64} height={12} progress={progress} />
        </View>

        {/* Right — single primary amount placeholder */}
        <View style={styles.amount}>
          <ShimmerRect width={72} height={14} borderRadius={6} progress={progress} />
          <ShimmerRect width={48} height={12} progress={progress} />
        </View>
      </View>
    </YStack>
  );
};

/** A full skeleton section: date header + N rows */
export const HistorySkeletonSection: React.FC<{
  rows?: number;
  progress: SharedValue<number>;
}> = ({ rows = 3, progress }) => {
  return (
    <View style={styles.section}>
      {/* Date label placeholder */}
      <View style={{ paddingTop: 20, paddingBottom: 12 }}>
        <ShimmerRect width={80} height={14} borderRadius={5} progress={progress} />
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
    paddingTop: 0,
  },
  section: {
    marginTop: 0,
  },
  card: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 0,
    gap: 12,
    backgroundColor: 'transparent',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  amount: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
