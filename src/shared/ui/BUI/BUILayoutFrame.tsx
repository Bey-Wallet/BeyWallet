import React, { useId } from 'react';
import { ScrollView } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { useBUIStore } from '~/state/buiStore';
import { BUIButton } from './BUIButton';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';
import { buiContentInsets, buiDimensions, buiRadii, buiSeparator } from './layout';

export function BUILayoutFrame({
  width,
  systemInsets,
  footer,
  onPress,
}: {
  width: number;
  systemInsets: boolean;
  footer: boolean;
  onPress: () => void;
}) {
  const appearance = useBUIStore((state) => state.appearance);
  const c = useBUITheme(appearance);
  const id = `buiFade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const inset = systemInsets ? 24 : 0;
  const footerHeight = buiDimensions.bottomBar + inset;
  const padding = buiContentInsets({
    topBar: buiDimensions.header + inset,
    bottomBar: footer ? footerHeight : undefined,
    top: inset,
    bottom: inset,
  });
  return (
    <YStack
      width={width}
      maxWidth="100%"
      height={520}
      self="center"
      overflow="hidden"
      bg={c.canvas}
    >
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={{ paddingTop: padding.top + 16, paddingBottom: padding.bottom + 16 }}
      >
        <YStack gap={16}>
          <YStack px={16}>
            <BUIText kind="h2">Page content</BUIText>
            <BUIText kind="body2" color={c.muted}>
              Scroll to the final row.
            </BUIText>
          </YStack>
          {[0, 1, 2, 3].map((group) => (
            <YStack key={group} mx={16} rounded={buiRadii.card} overflow="hidden" bg={c.surface}>
              {[0, 1, 2].map((row) => (
                <YStack key={row}>
                  <YStack minHeight={56} px={16} py={8} justify="center" gap={2}>
                    <BUIText>Sample row {group * 3 + row + 1}</BUIText>
                    <BUIText kind="body2" color={c.muted}>
                      Grouped content
                    </BUIText>
                  </YStack>
                  {row < 2 && (
                    <YStack
                      position="absolute"
                      b={0}
                      l={buiSeparator.startInset}
                      r={0}
                      height={buiSeparator.thickness}
                      bg={c.separator}
                    />
                  )}
                </YStack>
              ))}
            </YStack>
          ))}
          <YStack px={16}>
            <BUIText kind="body2" color={c.muted}>
              Final row — reachable above the action bar.
            </BUIText>
          </YStack>
        </YStack>
      </ScrollView>
      <YStack
        position="absolute"
        t={inset}
        l={0}
        r={0}
        height={64}
        bg={c.canvas}
        items="center"
        justify="center"
      >
        <BUIText kind="h3">Sample header · 64</BUIText>
      </YStack>
      {inset > 0 && (
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          height={inset}
          bg={c.raised}
          items="center"
          justify="center"
        >
          <BUIText kind="body4CAPS" color={c.muted}>
            STATUS INSET · 24
          </BUIText>
        </YStack>
      )}
      {footer && (
        <YStack
          position="absolute"
          b={0}
          l={0}
          r={0}
          height={footerHeight}
          pb={inset}
          justify="center"
        >
          <YStack position="absolute" t={0} l={0} r={0} b={0} pointerEvents="none">
            <Svg width="100%" height="100%" accessible={false}>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={c.canvas} stopOpacity={0} />
                  <Stop offset="0.7" stopColor={c.canvas} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${id})`} />
            </Svg>
          </YStack>
          <XStack px={16} gap={12}>
            <YStack flex={1}>
              <BUIButton
                appearance={appearance}
                variant="Secondary"
                size="large"
                fullWidth
                onPress={onPress}
              >
                Cancel
              </BUIButton>
            </YStack>
            <YStack flex={1}>
              <BUIButton appearance={appearance} size="large" fullWidth onPress={onPress}>
                Continue
              </BUIButton>
            </YStack>
          </XStack>
        </YStack>
      )}
      {inset > 0 && (
        <YStack
          position="absolute"
          b={0}
          l={0}
          r={0}
          height={inset}
          bg={c.raised}
          items="center"
          justify="center"
        >
          <BUIText kind="body4CAPS" color={c.muted}>
            NAVIGATION INSET · 24
          </BUIText>
        </YStack>
      )}
    </YStack>
  );
}
