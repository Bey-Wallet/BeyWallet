import React, { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { YStack, XStack } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useHistoryColors } from '../historyTheme';

export function HistoryPageSkeleton() {
  const colors = useHistoryColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = 0.5;
    if (!reducedMotion) opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Loading activity"
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={style} importantForAccessibility="no-hide-descendants">
        {[3, 2, 2].map((count, section) => (
          <YStack key={section} pt="$5" gap="$4">
            <YStack bg={colors.circle} width={90} height={22} rounded="$2" />
            <YStack gap="$2">
              {Array.from({ length: count }, (_, index) => (
                <XStack
                  key={index}
                  minHeight={80}
                  p="$4"
                  items="center"
                  gap={16}
                  bg={colors.card}
                  rounded="$6"
                >
                  <YStack width={44} height={44} bg={colors.circle} rounded={100} />
                  <YStack flex={1} gap="$2">
                    <YStack width="65%" height={18} bg={colors.circle} rounded="$2" />
                    <YStack width="45%" height={15} bg={colors.circle} rounded="$2" />
                  </YStack>
                  <YStack items="flex-end" gap="$2">
                    <YStack width={64} height={18} bg={colors.circle} rounded="$2" />
                    <YStack width={40} height={15} bg={colors.circle} rounded="$2" />
                  </YStack>
                </XStack>
              ))}
            </YStack>
          </YStack>
        ))}
      </Animated.View>
    </ScrollView>
  );
}
