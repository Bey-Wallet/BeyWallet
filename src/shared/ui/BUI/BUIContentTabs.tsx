import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, I18nManager } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';

export type BUISelectItem = { id: string; title: string };

export function BUIContentTabs({
  items,
  selectedId,
  onSelect,
}: {
  items: readonly BUISelectItem[];
  selectedId?: string;
  onSelect: (item: BUISelectItem) => void;
}) {
  const c = useBUITheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const tabWidth = items.length ? Math.max(0, width - 8) / items.length : 0;
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );
  const visualIndex = I18nManager.isRTL ? items.length - 1 - index : index;
  useEffect(() => {
    const motion = Animated.timing(offset, {
      toValue: Math.max(0, visualIndex) * tabWidth,
      duration: reducedMotion ? 0 : 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });
    motion.start();
    return () => motion.stop();
  }, [offset, visualIndex, tabWidth, reducedMotion]);
  return (
    <YStack minHeight={items.length ? 48 : 40} justify="center">
      <XStack
        height={40}
        p={4}
        rounded={20}
        bg={c.canvas}
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      >
        {!!items.length && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 4,
              top: 4,
              height: 32,
              width: tabWidth,
              borderRadius: 16,
              backgroundColor: c.surface,
              transform: [{ translateX: offset }],
            }}
          />
        )}
        {items.map((item, itemIndex) => (
          <AppPressable
            key={item.id}
            accessibilityLabel={item.title}
            accessibilityRole="tab"
            accessibilityState={{ selected: itemIndex === index }}
            flex={1}
            minHeight={32}
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            px={16}
            justify="center"
            items="center"
            rounded={16}
            onPress={() => onSelect(item)}
            pressStyle={{ opacity: 1 }}
            hoverStyle={{ opacity: 1 }}
          >
            <BUIText kind="label2" textAlign="center">
              {item.title}
            </BUIText>
          </AppPressable>
        ))}
      </XStack>
    </YStack>
  );
}
