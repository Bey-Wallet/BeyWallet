import React, { useState } from 'react';
import { PixelRatio, Text as NativeText } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIText } from './BUIText';
import { BUIIcon } from './BUIIcon';
import { useBUITheme } from './useBUITheme';

export const buiBadgeTones = ['neutral', 'primary', 'error', 'warning', 'success'] as const;
export type BUIBadgeTone = (typeof buiBadgeTones)[number];

function useBadgePalette(tone: BUIBadgeTone) {
  const c = useBUITheme();
  const color = {
    neutral: c.secondaryText,
    primary: c.primary,
    error: c.negative,
    warning: c.warning,
    success: c.positive,
  }[tone];
  return {
    color,
    tint: tone === 'neutral' ? c.raised : `${color}29`,
    fill: tone === 'neutral' ? c.raised : color,
    foreground: tone === 'primary' ? c.primaryForeground : tone === 'neutral' ? c.text : '#FFFFFF',
  };
}

export function BUILabel({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: BUIBadgeTone;
}) {
  const palette = useBadgePalette(tone);
  return (
    <YStack
      height={20}
      maxWidth="100%"
      rounded={4}
      px={5}
      pt={4}
      pb={5}
      bg={palette.tint}
      justify="center"
      flexShrink={0}
    >
      <BUIText
        kind="body4CAPS"
        lineHeight={11}
        color={palette.color}
        numberOfLines={1}
        ellipsizeMode="tail"
        textAlign="center"
      >
        {children.toUpperCase()}
      </BUIText>
    </YStack>
  );
}

export function BUICounter({
  count,
  compact = false,
  tone = 'error',
}: {
  count?: number | string | null;
  compact?: boolean;
  tone?: BUIBadgeTone;
}) {
  const palette = useBadgePalette(tone);
  const [height, setHeight] = useState(compact ? 12 : 14);
  const padding = Math.trunc((height * PixelRatio.get()) / 4) / PixelRatio.get();
  if (count == null || String(count).trim() === '') return null;
  return (
    <YStack
      minWidth={height}
      px={padding / 2}
      pb={1}
      rounded={100}
      bg={palette.fill}
      items="center"
      self="flex-start"
    >
      <NativeText
        allowFontScaling
        style={{
          fontFamily: compact ? 'InterTextSemiBold' : 'InterTextRegular',
          fontSize: compact ? 10 : 14,
          letterSpacing: compact ? 0.1 : 0.07,
          lineHeight: compact ? undefined : 14,
          color: palette.foreground,
          includeFontPadding: false,
          fontVariant: ['tabular-nums'],
        }}
        onTextLayout={(event) => {
          const next = event.nativeEvent.lines[0]?.height;
          if (next && Math.abs(height - next) > 0.1) setHeight(next);
        }}
      >
        {String(count)}
      </NativeText>
    </YStack>
  );
}

export function BUIBadgeButton({
  children,
  leading,
  trailing,
  onPress,
}: {
  children: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const c = useBUITheme();
  const content = (
    <XStack px={16} py={8} gap={6} rounded={100} bg={c.raised} items="center">
      {leading}
      <BUIText kind="label2">{children}</BUIText>
      {trailing}
    </XStack>
  );
  return onPress ? (
    <AppPressable accessibilityLabel={children} minHeight={48} justify="center" onPress={onPress}>
      {content}
    </AppPressable>
  ) : (
    content
  );
}

export function BUIVerificationBadge({
  size = 16,
  label = 'Verified sample',
}: {
  size?: number;
  label?: string;
}) {
  return <BUIIcon name="verification" size={size} tone="accent" label={label} />;
}

export function BUISpamBadge() {
  const c = useBUITheme();
  return (
    <YStack px={8} py={4} rounded={8} bg={c.warning} self="flex-start">
      <BUIText kind="label2">SPAM</BUIText>
    </YStack>
  );
}

export function BUIInlineLabel({
  title,
  badge,
  tone = 'neutral',
}: {
  title: string;
  badge: string;
  tone?: BUIBadgeTone;
}) {
  return (
    <XStack gap={8} items="center">
      <BUIText flex={1} minWidth={0} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </BUIText>
      <BUILabel tone={tone}>{badge}</BUILabel>
    </XStack>
  );
}
