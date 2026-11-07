import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';

export type BUINavigationTab = {
  id: string;
  title: string;
  renderIcon: (color: string, size: number) => React.ReactNode;
  unread?: boolean;
  hidden?: boolean;
  onLongPress?: () => void;
};

export function BUITabBar({
  items,
  selectedId,
  onSelect,
  bottomInset = 0,
  divider = false,
}: {
  items: readonly BUINavigationTab[];
  selectedId: string;
  onSelect: (item: BUINavigationTab) => void;
  bottomInset?: number;
  divider?: boolean;
}) {
  const c = useBUITheme();
  return (
    <YStack bg={c.canvas} pb={Math.max(0, bottomInset)}>
      {divider && (
        <YStack
          pointerEvents="none"
          position="absolute"
          t={0}
          l={0}
          r={0}
          height={0.5}
          bg={c.separator}
        />
      )}
      <XStack height={64} px={16}>
        {items
          .filter((item) => !item.hidden)
          .map((item) => {
            const selected = selectedId === item.id;
            const color = selected ? c.tabActive : c.tabInactive;
            return (
              <AppPressable
                key={item.id}
                flex={1}
                minHeight={64}
                items="center"
                justify="center"
                accessibilityLabel={`${item.title}${item.unread ? ', unread' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onSelect(item)}
                onLongPress={item.onLongPress}
              >
                <YStack
                  width={28}
                  height={28}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {item.renderIcon(color, 28)}
                </YStack>
                <BUIText kind="label3" mt={4} color={color} numberOfLines={1}>
                  {item.title}
                </BUIText>
                {item.unread && (
                  <YStack
                    pointerEvents="none"
                    position="absolute"
                    t={8}
                    width={6}
                    height={6}
                    rounded={3}
                    bg={c.negative}
                    style={{ marginStart: 16 }}
                  />
                )}
              </AppPressable>
            );
          })}
      </XStack>
    </YStack>
  );
}

export function BUIBottomBar({
  children,
  bottomInset = 0,
}: {
  children: React.ReactNode;
  bottomInset?: number;
}) {
  const c = useBUITheme();
  const inset = Math.max(0, bottomInset);
  const id = `buiBottomBar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <YStack height={84 + inset} pb={inset} justify="center">
      <YStack pointerEvents="none" position="absolute" t={0} b={0} l={0} r={0} accessible={false}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.canvas} stopOpacity={0} />
              <Stop offset="0.7" stopColor={c.canvas} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </YStack>
      <XStack px={16} gap={12} items="center">
        {children}
      </XStack>
    </YStack>
  );
}
