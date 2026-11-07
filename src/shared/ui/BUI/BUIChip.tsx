import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type ImageSourcePropType } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { BUIText } from './BUIText';
import { BUIAvatar } from './BUIAvatar';
import { useBUITheme } from './useBUITheme';
import type { BUISelectItem } from './BUIContentTabs';
import { buiChipScrollOffset } from './selectorGeometry';

export type BUIChipItem = BUISelectItem & { image?: ImageSourcePropType; initials?: string };

export function BUIChip({
  children,
  selected = false,
  image,
  initials,
  onPress,
}: {
  children: string;
  selected?: boolean;
  image?: ImageSourcePropType;
  initials?: string;
  onPress: () => void;
}) {
  const c = useBUITheme();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const [width, setWidth] = useState(48);
  const hasImage = !!image || initials !== undefined;
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(selected ? 1 : 0);
      return;
    }
    const motion = Animated.spring(progress, {
      toValue: selected ? 1 : 0,
      stiffness: 1500,
      damping: 77.46,
      mass: 1,
      useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [selected, progress, reducedMotion]);
  return (
    <AppPressable
      accessibilityRole="checkbox"
      accessibilityLabel={children}
      accessibilityState={{ checked: selected }}
      height={32}
      minHeight={32}
      rounded={16}
      hitSlop={{
        top: 8,
        bottom: 8,
        left: Math.max(0, (48 - width) / 2),
        right: Math.max(0, (48 - width) / 2),
      }}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      onPress={onPress}
    >
      <Animated.View
        style={{
          height: 32,
          borderRadius: 16,
          paddingLeft: hasImage ? 6 : 12,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [c.buttons.Secondary[0], c.pressed],
          }),
        }}
      >
        {hasImage && (
          <YStack accessible={false} importantForAccessibility="no-hide-descendants">
            <BUIAvatar source={image} initials={initials} size={20} label="" />
          </YStack>
        )}
        <BUIText kind="label2" color={c.buttons.Secondary[3]}>
          {children}
        </BUIText>
      </Animated.View>
    </AppPressable>
  );
}

export function BUIOutlineChip({
  children,
  selected = false,
  onPress,
}: {
  children: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const c = useBUITheme();
  const [size, setSize] = useState({ width: 48, height: 32 });
  return (
    <AppPressable
      accessibilityLabel={children}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      rounded={16}
      px={12}
      py={6}
      bg={selected ? c.tertiaryFill : c.canvas}
      onPress={onPress}
      onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
      hitSlop={{
        top: Math.max(0, (48 - size.height) / 2),
        bottom: Math.max(0, (48 - size.height) / 2),
        left: Math.max(0, (48 - size.width) / 2),
        right: Math.max(0, (48 - size.width) / 2),
      }}
    >
      <YStack
        position="absolute"
        t={0}
        b={0}
        l={0}
        r={0}
        rounded={16}
        borderWidth={1.5}
        borderColor={c.tertiaryFill}
        pointerEvents="none"
      />
      <BUIText kind="label2" numberOfLines={1} textAlign="center">
        {children}
      </BUIText>
    </AppPressable>
  );
}

export function BUITag({
  children,
  icon,
  onPress,
}: {
  children: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const c = useBUITheme();
  return (
    <AppPressable
      accessibilityLabel={children}
      accessibilityRole={onPress ? 'button' : 'text'}
      minHeight={32}
      height={32}
      rounded={16}
      px={16}
      py={8}
      flexDirection="row"
      items="center"
      gap={8}
      bg={c.buttons.Secondary[0]}
      onPress={onPress}
    >
      {icon && (
        <YStack
          width={16}
          height={16}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {icon}
        </YStack>
      )}
      <BUIText kind="label2" color={c.buttons.Secondary[3]} numberOfLines={1} flexShrink={1}>
        {children}
      </BUIText>
    </AppPressable>
  );
}

export function BUITags({ children }: { children: React.ReactNode }) {
  return (
    <XStack flexWrap="wrap" gap={8}>
      {children}
    </XStack>
  );
}

export function BUIChipBar({
  items,
  selectedId,
  onSelect,
  scrollToSelected = false,
}: {
  items: readonly BUIChipItem[];
  selectedId?: string;
  onSelect: (item: BUIChipItem) => void;
  scrollToSelected?: boolean;
}) {
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const reducedMotion = useReducedMotion();
  const viewport = useRef(0);
  const current = useRef(0);
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const reveal = useCallback(
    (id?: string) => {
      const item = id ? layouts.current[id] : undefined;
      if (!item || !viewport.current) return;
      const next = buiChipScrollOffset(current.current, viewport.current, item);
      if (next !== current.current) {
        current.current = next;
        scroll.current?.scrollTo({ x: next, animated: !reducedMotion });
      }
    },
    [reducedMotion],
  );
  useEffect(() => {
    if (scrollToSelected) reveal(selectedId);
  }, [selectedId, items, scrollToSelected, reveal]);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={({ nativeEvent }) => {
        viewport.current = nativeEvent.layout.width;
        if (scrollToSelected) reveal(selectedId);
      }}
      onScroll={({ nativeEvent }) => {
        current.current = nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
    >
      <XStack px={16} pt={8} pb={16} gap={6}>
        {items.map((item) => (
          <YStack
            key={item.id}
            onLayout={({ nativeEvent }) => {
              layouts.current[item.id] = nativeEvent.layout;
              if (scrollToSelected && item.id === selectedId) reveal(selectedId);
            }}
          >
            <BUIChip
              selected={item.id === selectedId}
              image={item.image}
              initials={item.initials}
              onPress={() => {
                onSelect(item);
                reveal(item.id);
              }}
            >
              {item.title}
            </BUIChip>
          </YStack>
        ))}
      </XStack>
    </ScrollView>
  );
}
