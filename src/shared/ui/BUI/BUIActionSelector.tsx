import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, I18nManager, Modal, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Check, ChevronsUpDown } from '@tamagui/lucide-icons';
import { ScrollView, Theme, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUIStore } from '~/state/buiStore';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';
import type { BUISelectItem } from './BUIContentTabs';
import { buiSelectorPosition } from './selectorGeometry';

export function BUIActionSelector({
  items,
  selectedId,
  onSelect,
  variant = 'Tertiary',
  leadingIcon,
  alignment = 'center',
  offset = { x: 0, y: 12 },
  label = 'Choose option',
}: {
  items: readonly BUISelectItem[];
  selectedId?: string;
  onSelect: (item: BUISelectItem) => void;
  variant?: 'Secondary' | 'Tertiary';
  leadingIcon?: React.ReactNode;
  alignment?: 'start' | 'center';
  offset?: { x: number; y: number };
  label?: string;
}) {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const trigger = useRef<React.ElementRef<typeof AppPressable>>(null);
  const [position, setPosition] = useState<ReturnType<typeof buiSelectorPosition> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const generation = useRef(0);
  const scale = useRef(new Animated.Value(0.8)).current;
  const alpha = useRef(new Animated.Value(0)).current;
  const selected = items.find((item) => item.id === selectedId);
  const menuWidth = Math.max(0, Math.min(240, width - 16));
  const menuHeight = Math.min(height, items.length * 48 + Math.max(0, items.length - 1) * 0.5);
  const secondary = variant === 'Secondary';
  const reset = useCallback(() => {
    generation.current += 1;
    setExpanded(false);
    setPosition(null);
  }, []);
  useEffect(() => {
    reset();
    return () => {
      generation.current += 1;
    };
  }, [width, height, appearance, focused, items, reset]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') reset();
    });
    return () => subscription.remove();
  }, [reset]);
  useEffect(() => {
    if (!position) {
      scale.setValue(0.8);
      alpha.setValue(0);
      return;
    }
    if (reducedMotion) {
      scale.setValue(expanded ? 1 : 0.8);
      alpha.setValue(expanded ? 1 : 0);
      if (!expanded) setPosition(null);
      return;
    }
    const motion = Animated.parallel([
      Animated.timing(scale, {
        toValue: expanded ? 1 : 0.8,
        duration: expanded ? 120 : 1,
        delay: expanded ? 0 : 74,
        easing: expanded ? Easing.bezier(0, 0, 0.2, 1) : Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(alpha, {
        toValue: expanded ? 1 : 0,
        duration: expanded ? 30 : 75,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]);
    motion.start(({ finished }) => {
      if (finished && !expanded) setPosition(null);
    });
    return () => motion.stop();
  }, [expanded, position, scale, alpha, reducedMotion]);
  const open = () => {
    if (!focused || !items.length) return;
    if (position) {
      setExpanded(false);
      return;
    }
    const request = ++generation.current;
    trigger.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      if (generation.current !== request) return;
      setPosition(
        buiSelectorPosition(
          { x, y, width: anchorWidth, height: anchorHeight },
          { width, height },
          { width: menuWidth, height: menuHeight },
          alignment,
          I18nManager.isRTL,
          offset,
        ),
      );
      setExpanded(true);
    });
  };
  return (
    <>
      <YStack minHeight={48} justify="center" items="flex-start">
        <AppPressable
          ref={trigger}
          accessibilityLabel={`${label}${selected ? `, ${selected.title}` : ''}`}
          accessibilityState={{ expanded }}
          minHeight={secondary ? 32 : 36}
          height={secondary ? 32 : 36}
          rounded={secondary ? 16 : 20}
          px={secondary ? 12 : 16}
          flexDirection="row"
          items="center"
          gap={secondary ? 6 : 8}
          bg={secondary ? c.buttons.Secondary[0] : c.tertiaryFill}
          onPress={open}
        >
          {leadingIcon && (
            <YStack
              width={16}
              height={16}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {leadingIcon}
            </YStack>
          )}
          <BUIText kind="label2">{selected?.title ?? ''}</BUIText>
          <ChevronsUpDown size={16} color={c.iconSecondary} />
        </AppPressable>
      </YStack>
      <Modal
        visible={!!position}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setExpanded(false)}
      >
        <Theme name={appearance === 'light' ? 'light_bui' : 'dark_bui'}>
          <YStack flex={1}>
            <AppPressable
              accessibilityLabel="Dismiss selector"
              children={null}
              position="absolute"
              t={0}
              b={0}
              l={0}
              r={0}
              onPress={() => setExpanded(false)}
            />
            {position && (
              <Animated.View
                accessibilityViewIsModal
                style={{
                  position: 'absolute',
                  left: position.x,
                  top: position.y,
                  width: menuWidth,
                  maxHeight: menuHeight,
                  borderRadius: 20,
                  overflow: 'hidden',
                  backgroundColor: c.raised,
                  opacity: alpha,
                  transformOrigin: [position.originX, position.originY, 0],
                  transform: [{ scale }],
                }}
              >
                <ScrollView bounces={false}>
                  {items.map((item, index) => (
                    <YStack key={item.id}>
                      <AppPressable
                        accessibilityRole="radio"
                        accessibilityLabel={item.title}
                        accessibilityState={{ checked: selectedId === item.id }}
                        height={48}
                        minHeight={48}
                        px={16}
                        flexDirection="row"
                        items="center"
                        gap={8}
                        onPress={() => {
                          if (!expanded) return;
                          setExpanded(false);
                          onSelect(item);
                        }}
                      >
                        <BUIText flex={1} kind="label1" numberOfLines={1}>
                          {item.title}
                        </BUIText>
                        {selectedId === item.id && <Check size={16} color={c.primary} />}
                      </AppPressable>
                      {index < items.length - 1 && (
                        <YStack height={0.5} style={{ marginStart: 16 }} bg={c.separator} />
                      )}
                    </YStack>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </YStack>
        </Theme>
      </Modal>
    </>
  );
}
