import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { View as NativeView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { X } from '@tamagui/lucide-icons';
import { Text, View, YStack } from 'tamagui';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';
import { AppPressable } from '~/shared/ui/AppPressable';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';

const STACK_PEEK = 10;

function DismissIcon({ size }: { size: number }) {
  return <X size={size} color="$gray10" />;
}

export interface HomePrompt {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  onDismiss: () => void | Promise<void>;
}

function StackLayer({
  card,
  depth,
  visibleLayers,
  width,
  height,
  minHeight,
  translation,
  reducedMotion,
  disabled,
  onHeight,
  onOpen,
  onDismiss,
  onAdvance,
}: {
  card: HomePrompt;
  depth: number;
  visibleLayers: number;
  width: number;
  height: number;
  minHeight: number;
  translation: SharedValue<number>;
  reducedMotion: boolean;
  disabled: boolean;
  onHeight: (height: number) => void;
  onOpen: () => void;
  onDismiss: () => void;
  onAdvance: (step: number) => void;
}) {
  const front = depth === 0;
  const style = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: depth < visibleLayers ? 1 : 0,
        transform: front ? [] : [{ translateY: depth * STACK_PEEK }, { scale: 1 - depth * 0.05 }],
      };
    }
    const progress = Math.min(Math.abs(translation.value) / width, 1);
    if (front) {
      return {
        opacity: interpolate(progress, [0, 0.75, 1], [1, 1, 0], Extrapolation.CLAMP),
        transform: [
          { translateX: translation.value },
          {
            rotate: `${interpolate(
              translation.value,
              [-width, width],
              [-7, 7],
              Extrapolation.CLAMP,
            )}deg`,
          },
        ],
      };
    }
    const position = depth - progress;
    return {
      opacity: depth === visibleLayers ? progress : 1,
      transform: [{ translateY: position * STACK_PEEK }, { scale: 1 - position * 0.05 }],
    };
  });

  return (
    <Animated.View
      collapsable={false}
      pointerEvents={front ? 'auto' : 'none'}
      accessibilityElementsHidden={!front}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
      style={[
        {
          position: front ? 'relative' : 'absolute',
          width: '100%',
          top: 0,
          left: 0,
          right: 0,
          height: front ? undefined : height,
          zIndex: 10 - depth,
        },
        style,
      ]}
      onLayout={front ? (event) => onHeight(event.nativeEvent.layout.height) : undefined}
    >
      <YStack
        width="100%"
        position="relative"
        bg="$buttonDefaultSecondary"
        rounded="$6"
        borderWidth={1}
        borderColor="$borderColor"
        overflow="hidden"
        height={front ? undefined : height}
      >
        <AppPressable
          width="100%"
          testID={front ? `home-prompt-${card.id}` : undefined}
          minHeight={minHeight}
          p={appSpacing.gap}
          pr={appSpacing.gap + appDimensions.touchTarget}
          flexDirection="row"
          items="flex-start"
          gap={appSpacing.gap}
          bg="$buttonDefaultSecondary"
          hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
          pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
          disabled={disabled || !front}
          accessibilityLabel={card.title}
          accessibilityHint={card.description}
          accessibilityActions={
            visibleLayers > 1
              ? [
                  { name: 'increment', label: 'Next card' },
                  { name: 'decrement', label: 'Previous card' },
                ]
              : undefined
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') onAdvance(1);
            if (event.nativeEvent.actionName === 'decrement') onAdvance(-1);
          }}
          onPress={onOpen}
        >
          <View
            width={32}
            height={32}
            rounded={100}
            bg="$gray3"
            items="center"
            justify="center"
            aria-hidden
          >
            {card.icon}
          </View>
          <YStack flex={1} minWidth={0} gap="$1">
            <Text {...appTypography.label2} fontWeight="600" color="$color" textAlign="left">
              {card.title}
            </Text>
            <Text {...appTypography.body3} color="$gray10" textAlign="left">
              {card.description}
            </Text>
          </YStack>
        </AppPressable>
        {front && (
          <NativeView style={{ position: 'absolute', top: 6, right: 6 }}>
            <HeaderIconButton
              accessibilityLabel={`Dismiss ${card.title}`}
              icon={DismissIcon}
              disabled={disabled}
              onPress={onDismiss}
            />
          </NativeView>
        )}
      </YStack>
    </Animated.View>
  );
}

/** Horizontal cycling never dismisses a prompt; only its own X changes its saved visibility. */
export function PromptCardStack({ cards }: { cards: HomePrompt[] }) {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const minHeight = Math.max(84, 84 * fontScale);
  const [width, setWidth] = useState(Math.max(1, windowWidth - 32));
  const [height, setHeight] = useState(minHeight);
  const [activeId, setActiveId] = useState(cards[0]?.id);
  const [direction, setDirection] = useState(-1);
  const [dismissing, setDismissing] = useState(false);
  const translation = useSharedValue(0);
  const transitioning = useSharedValue(false);
  const dragging = useSharedValue(false);
  const swipeDirection = useSharedValue(-1);
  const dismissPending = useRef(false);
  const mounted = useRef(true);
  const index = Math.max(
    0,
    cards.findIndex((card) => card.id === activeId),
  );
  const current = useRef({ cards, index });
  current.current = { cards, index };
  const cardIds = cards.map((card) => card.id).join(',');

  useLayoutEffect(() => {
    cancelAnimation(translation);
    translation.value = 0;
    transitioning.value = false;
    dragging.value = false;
  }, [activeId, cardIds, reducedMotion, width, translation, transitioning, dragging]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(translation);
    };
  }, [translation]);

  const advance = useCallback((step: number) => {
    if (!mounted.current || dismissPending.current) return;
    const { cards: latest, index: position } = current.current;
    if (latest.length > 1) {
      setActiveId(latest[(position + step + latest.length) % latest.length].id);
    }
  }, []);

  const pan = Gesture.Pan()
    .enabled(cards.length > 1 && !dismissing)
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart(() => {
      if (transitioning.value) return;
      cancelAnimation(translation);
      dragging.value = true;
    })
    .onUpdate((event) => {
      if (transitioning.value) return;
      const nextDirection = event.translationX < 0 ? -1 : 1;
      if (swipeDirection.value !== nextDirection) {
        swipeDirection.value = nextDirection;
        runOnJS(setDirection)(nextDirection);
      }
      translation.value = event.translationX;
    })
    .onEnd((event) => {
      if (transitioning.value) return;
      const commit = Math.abs(event.translationX) > width * 0.22 || Math.abs(event.velocityX) > 650;
      if (!commit) return;
      const sign =
        event.translationX === 0 ? Math.sign(event.velocityX) : Math.sign(event.translationX);
      transitioning.value = true;
      if (reducedMotion) {
        runOnJS(advance)(sign < 0 ? 1 : -1);
      } else {
        translation.value = withTiming(sign * width * 1.15, { duration: 230 }, (finished) => {
          if (finished) runOnJS(advance)(sign < 0 ? 1 : -1);
        });
      }
    })
    .onFinalize(() => {
      if (!transitioning.value) {
        dragging.value = false;
        translation.value = reducedMotion ? 0 : withSpring(0, { damping: 22, stiffness: 240 });
      }
    });

  if (cards.length === 0) return null;
  const active = cards[index];
  const visibleLayers = Math.min(cards.length, 2);
  const depths = cards.length === 1 ? [0] : Array.from({ length: visibleLayers + 1 }, (_, i) => i);
  const canInteract = () => !dismissPending.current && !transitioning.value && !dragging.value;
  const dismiss = async () => {
    if (!canInteract()) return;
    dismissPending.current = true;
    setDismissing(true);
    const nextId = cards[(index + 1) % cards.length]?.id;
    try {
      await active.onDismiss();
      if (mounted.current) setActiveId(nextId);
    } finally {
      dismissPending.current = false;
      if (mounted.current) setDismissing(false);
    }
  };

  return (
    <GestureDetector gesture={pan}>
      <NativeView
        testID="home-prompt-stack"
        collapsable={false}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: (visibleLayers - 1) * STACK_PEEK,
        }}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      >
        {depths.reverse().map((depth) => {
          const step = direction < 0 ? depth : -depth;
          const card = cards[(index + step + cards.length) % cards.length];
          return (
            <StackLayer
              key={depth}
              card={card}
              depth={depth}
              visibleLayers={visibleLayers}
              width={width}
              height={Math.max(height, minHeight)}
              minHeight={minHeight}
              translation={translation}
              reducedMotion={reducedMotion}
              disabled={dismissing}
              onHeight={(nextHeight) =>
                setHeight((old) => (Math.abs(old - nextHeight) > 0.5 ? nextHeight : old))
              }
              onOpen={() => {
                if (canInteract()) active.onPress();
              }}
              onDismiss={dismiss}
              onAdvance={(step) => {
                if (canInteract()) advance(step);
              }}
            />
          );
        })}
      </NativeView>
    </GestureDetector>
  );
}
