import React, { useState } from 'react';
import { Animated, Modal, Text as NativeText } from 'react-native';
import { Info } from '@tamagui/lucide-icons';
import { ScrollView, Theme, XStack, YStack } from 'tamagui';
import Svg, { Polygon } from 'react-native-svg';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIText } from './BUIText';
import { BUIAppearanceProvider, useBUITheme } from './useBUITheme';
import { useBUIAnchoredPopup } from './useBUIAnchoredPopup';
import { buiTooltipLayout } from './popupGeometry';

export function BUITooltip({
  label,
  text,
  badge,
  iconTrigger = true,
  preferAbove = false,
  centerTail = false,
  maxWidth = 200,
  onContentPress,
}: {
  label: string;
  text: string;
  badge?: string;
  iconTrigger?: boolean;
  preferAbove?: boolean;
  centerTail?: boolean;
  maxWidth?: number;
  onContentPress?: () => void;
}) {
  const popup = useBUIAnchoredPopup('tooltip', !!text.trim(), iconTrigger);
  const c = useBUITheme(popup.appearance);
  const [contentHeight, setContentHeight] = useState(40);
  const [textSize, setTextSize] = useState({ text: '', width: 0 });
  const [badgeSize, setBadgeSize] = useState({ text: '', width: 0 });
  const naturalWidth =
    textSize.text === text && (badge == null || badgeSize.text === badge)
      ? textSize.width + 24 + (badge != null ? badgeSize.width + 16 : 0)
      : undefined;
  const layout = buiTooltipLayout({
    anchor: popup.anchor ?? { x: 0, y: 0, width: 16, height: 16 },
    window: popup.window,
    contentHeight,
    naturalWidth,
    maxWidth,
    preferAbove,
    centerTail,
  });
  const tail = (
    <YStack height={6} pointerEvents="none">
      <Svg width={14} height={6} style={{ marginLeft: layout.tailLeft }}>
        <Polygon points={layout.tailOnTop ? '7,0 0,6 14,6' : '0,0 14,0 7,6'} fill={c.pressed} />
      </Svg>
    </YStack>
  );
  const body = (
    <XStack px={12} py={10} gap={6} items="center">
      {badge != null && (
        <YStack
          height={20}
          rounded={4}
          px={5}
          pt={4}
          pb={5}
          bg={c.primaryForeground}
          justify="center"
          flexShrink={0}
        >
          <BUIText kind="body4CAPS" lineHeight={11} color={c.pressed} numberOfLines={1}>
            {badge.toUpperCase()}
          </BUIText>
        </YStack>
      )}
      <BUIText kind="body2" flexShrink={1}>
        {text}
      </BUIText>
    </XStack>
  );
  return (
    <BUIAppearanceProvider value={popup.appearance}>
      <YStack
        position="absolute"
        opacity={0}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <NativeText
          style={{
            width: 100000,
            fontFamily: 'InterTextRegular',
            fontSize: 14,
            letterSpacing: 0.07,
            includeFontPadding: false,
          }}
          onTextLayout={({ nativeEvent }) => {
            const width = Math.max(0, ...nativeEvent.lines.map((line) => line.width));
            setTextSize((current) =>
              current.text === text && current.width === width ? current : { text, width },
            );
          }}
        >
          {text}
        </NativeText>
        {badge != null && (
          <NativeText
            numberOfLines={1}
            style={{
              width: 100000,
              fontFamily: 'InterTextMedium',
              fontSize: 10,
              letterSpacing: 0.1,
              includeFontPadding: false,
            }}
            onTextLayout={({ nativeEvent }) => {
              const width = nativeEvent.lines[0]?.width ?? 0;
              setBadgeSize((current) =>
                current.text === badge && current.width === width
                  ? current
                  : { text: badge, width },
              );
            }}
          >
            {badge.toUpperCase()}
          </NativeText>
        )}
      </YStack>
      <AppPressable
        ref={popup.trigger}
        accessibilityLabel={label}
        accessibilityState={{ expanded: popup.expanded }}
        minWidth={48}
        minHeight={48}
        px={iconTrigger ? 0 : 16}
        py={8}
        rounded={16}
        flexDirection="row"
        items="center"
        justify="center"
        gap={8}
        bg={iconTrigger ? 'transparent' : c.secondaryButton[0]}
        onPress={popup.open}
        onLongPress={popup.open}
      >
        <Info size={16} color={c.iconSecondary} />
        {!iconTrigger && <BUIText kind="label2">{label}</BUIText>}
      </AppPressable>
      <Modal
        visible={!!popup.anchor}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={popup.close}
      >
        <Theme name={popup.appearance === 'light' ? 'light_bui' : 'dark_bui'}>
          <YStack flex={1}>
            <AppPressable
              accessibilityLabel="Dismiss tooltip"
              children={null}
              position="absolute"
              t={0}
              b={0}
              l={0}
              r={0}
              onPress={popup.close}
            />
            {popup.anchor && (
              <Animated.View
                accessibilityViewIsModal
                pointerEvents={popup.expanded ? 'auto' : 'none'}
                style={{
                  position: 'absolute',
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  opacity: popup.alpha,
                  transformOrigin: [layout.originX, layout.originY, 0],
                  transform: [{ scale: popup.scale }],
                }}
              >
                {layout.tailOnTop && tail}
                <YStack bg={c.pressed} rounded={12} overflow="hidden">
                  <ScrollView
                    bounces={false}
                    maxHeight={Math.max(0, layout.height - 6)}
                    onContentSizeChange={(_, height) =>
                      setContentHeight((current) => (current === height ? current : height))
                    }
                  >
                    {onContentPress ? (
                      <AppPressable
                        accessibilityLabel={text}
                        minHeight={40}
                        hitSlop={4}
                        onPress={() => {
                          if (popup.close()) onContentPress();
                        }}
                      >
                        {body}
                      </AppPressable>
                    ) : (
                      body
                    )}
                  </ScrollView>
                </YStack>
                {!layout.tailOnTop && tail}
              </Animated.View>
            )}
          </YStack>
        </Theme>
      </Modal>
    </BUIAppearanceProvider>
  );
}
