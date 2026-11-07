import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { EyeOff, Shield, Ticket, X } from '@tamagui/lucide-icons';
import { ScrollView, XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { BUIText } from './BUIText';
import { BUIIcon } from './BUIIcon';
import { useBUITheme } from './useBUITheme';

export function BUICardShelf({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <XStack px={16} py={8} gap={8} items="flex-start">
        {children}
      </XStack>
    </ScrollView>
  );
}

export function BUIShelfCard({
  title,
  subtitle,
  detail,
  avatar,
  variant = 'yield',
  positive = true,
  editing = false,
  onPress,
  onRemove,
}: {
  title: string;
  subtitle: string;
  detail?: string;
  avatar: React.ReactNode;
  variant?: 'yield' | 'favorite';
  positive?: boolean;
  editing?: boolean;
  onPress: () => void;
  onRemove?: () => void;
}) {
  const c = useBUITheme();
  const favorite = variant === 'favorite';
  const reducedMotion = useReducedMotion();
  const [removing, setRemoving] = useState(false);
  const progress = useRef(new Animated.Value(1)).current;
  const removeCallback = useRef(onRemove);
  removeCallback.current = onRemove;
  useEffect(() => {
    if (!removing) return;
    if (reducedMotion) {
      removeCallback.current?.();
      return;
    }
    const motion = Animated.timing(progress, {
      toValue: 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    });
    motion.start(({ finished }) => {
      if (finished) removeCallback.current?.();
    });
    return () => motion.stop();
  }, [removing, reducedMotion, progress]);
  return (
    <Animated.View
      style={{
        width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 100] }),
        opacity: progress,
      }}
    >
      <YStack width={100}>
        <AppPressable
          accessibilityLabel={`${title}, ${subtitle}${detail ? `, ${detail}` : ''}`}
          disabled={editing || removing}
          accessibilityState={{ disabled: editing || removing }}
          rounded={favorite ? 12 : 16}
          bg={c.surface}
          px={favorite ? 8 : 10}
          pt={16}
          pb={favorite ? 16 : 14}
          items="center"
          onPress={() => {
            if (!editing && !removing) onPress();
          }}
        >
          <YStack accessible={false} importantForAccessibility="no-hide-descendants">
            {avatar}
          </YStack>
          <BUIText kind="body3" mt={favorite ? 8 : 10} numberOfLines={1} textAlign="center">
            {title}
          </BUIText>
          <BUIText
            kind="body3"
            mt={favorite ? 1 : 2}
            numberOfLines={1}
            textAlign="center"
            color={positive ? c.positive : c.negative}
          >
            {subtitle}
          </BUIText>
          {detail !== undefined && (
            <BUIText kind="body3" mt={1} numberOfLines={1} textAlign="center" color={c.muted}>
              {detail}
            </BUIText>
          )}
        </AppPressable>
        {favorite && editing && !removing && onRemove && (
          <AppPressable
            accessibilityLabel={`Remove ${title}`}
            width={24}
            height={24}
            minHeight={24}
            hitSlop={12}
            position="absolute"
            t={-4}
            r={-4}
            rounded={12}
            bg={c.raised}
            items="center"
            justify="center"
            onPress={() => setRemoving(true)}
          >
            <X size={16} color={c.iconSecondary} />
          </AppPressable>
        )}
      </YStack>
    </Animated.View>
  );
}

export function BUICollectibleCard({
  title,
  collection,
  width,
  hidden = false,
  sale = false,
  onPress,
}: {
  title: string;
  collection: string;
  width: number;
  hidden?: boolean;
  sale?: boolean;
  onPress: () => void;
}) {
  const c = useBUITheme();
  const safeWidth = Math.max(48, width);
  return (
    <AppPressable
      accessibilityLabel={
        hidden ? 'Hidden collectible' : `${title}, ${collection}${sale ? ', on sale' : ''}`
      }
      width={safeWidth}
      rounded={16}
      overflow="hidden"
      bg={c.surface}
      onPress={onPress}
    >
      <YStack
        width={safeWidth}
        height={safeWidth}
        bg={c.raised}
        items="center"
        justify="center"
        accessible={false}
      >
        {hidden ? (
          <EyeOff size={36} color={c.iconSecondary} />
        ) : (
          <Shield size={36} color={c.iconSecondary} />
        )}
        {sale && (
          <YStack
            position="absolute"
            t={8}
            r={8}
            width={26}
            height={26}
            rounded={13}
            bg={c.surface}
            items="center"
            justify="center"
          >
            <Ticket size={16} color={c.iconSecondary} />
          </YStack>
        )}
      </YStack>
      <YStack px={12} py={8}>
        <BUIText kind="label2" numberOfLines={1}>
          {hidden ? '••••' : title}
        </BUIText>
        <BUIText kind="body3" color={c.muted} numberOfLines={1}>
          {hidden ? '••••' : collection}
        </BUIText>
      </YStack>
    </AppPressable>
  );
}

export function BUISeeAllCard({ width, onPress }: { width: number; onPress: () => void }) {
  const c = useBUITheme();
  return (
    <AppPressable
      accessibilityLabel="See all"
      width={width}
      minHeight={48}
      height={width}
      rounded={16}
      items="center"
      justify="center"
      onPress={onPress}
    >
      <YStack
        width={44}
        height={44}
        rounded={22}
        bg={c.secondaryButton[0]}
        items="center"
        justify="center"
      >
        <BUIIcon name="chevron" />
      </YStack>
      <BUIText kind="label3" color={c.muted} mt={8}>
        See all
      </BUIText>
    </AppPressable>
  );
}
