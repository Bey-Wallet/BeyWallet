import React from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack, useTheme } from 'tamagui';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  rememberSettingsOrigin,
  settingsTabIsActive,
} from '~/features/settings/settingsNavigation';
import * as Haptics from 'expo-haptics';

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (settingsTabIsActive(state.routes[state.index].name)) return <></>;

  return (
    <YStack
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      px="$4"
      pt="$1"
      backgroundColor="$background"
      borderColor="$borderColor"
      borderTopWidth={0.3}

      pb={insets.bottom}
    >
      <XStack height={48} alignItems="center" justifyContent="space-between">
        {state.routes.map((route, index): React.JSX.Element => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const handleTabPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              if (settingsTabIsActive(route.name)) {
                rememberSettingsOrigin(state.routes[state.index].name);
              }
              navigation.navigate(route.name);
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
              // Ignore haptic feedback errors
            });
          };

          const activeColor = theme.color?.val || '#000000';
          const inactiveColor = theme.color4?.val || '#888888';

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
              accessibilityRole="tab"
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
              accessibilityState={{ selected: isFocused }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
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
