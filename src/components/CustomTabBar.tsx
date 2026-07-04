import React, { useState } from "react";
import { LayoutChangeEvent, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack, useTheme } from "tamagui";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "~/context/ThemeContext";

const MARGIN = 6;
const ANIMATION_DURATION = 200;

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps): JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const routesCount = state.routes.length || 1;
  const tabWidth = containerWidth / routesCount;
  const indicatorWidth = tabWidth - MARGIN * 2;

  const activeTabIndex = useDerivedValue(() => {
    return withTiming(state.index, {
      duration: ANIMATION_DURATION,
    });
  });

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    const translateX = tabWidth * activeTabIndex.value + MARGIN;
    return {
      transform: [{ translateX }],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <YStack
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      px="$4"
      py="$1"
      backgroundColor="$background"
      borderColor="$borderColor"
      borderTopWidth={0.3}

      pb={insets.bottom}
    >
      <XStack
        height={65}
        alignItems="center"
        justifyContent="space-between"
        onLayout={onLayout}
      >
        {/* Animated sliding background indicator */}
        {containerWidth > 0 && (
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: MARGIN,
                bottom: MARGIN,
                width: indicatorWidth,
                borderRadius: 100,
                backgroundColor: theme.color2?.val,
              },
              animatedBackgroundStyle,
            ]}
          />
        )}

        {state.routes.map((route, index): JSX.Element => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const handleTabPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
              // Ignore haptic feedback errors
            });
          };

          const activeColor = theme.color?.val || "#000000";
          const inactiveColor = theme.color4?.val || "#888888";

          const icon = options.tabBarIcon
            ? options.tabBarIcon({
              focused: isFocused,
              color: isFocused ? activeColor : inactiveColor,
              size: 24,
            })
            : null;

          return (
            <Pressable
              key={route.key}
              onPress={handleTabPress}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              {icon}
            </Pressable>
          );
        })}
      </XStack>
    </YStack>
  );
}
