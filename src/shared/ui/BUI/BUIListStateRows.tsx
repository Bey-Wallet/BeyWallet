import React from 'react';
import { XStack, YStack } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useBUIStore } from '~/state/buiStore';
import { BUIText } from './BUIText';
import { BUIButton } from './BUIButton';
import { BUIListRow } from './BUIListRow';
import { useBUITheme } from './useBUITheme';

export function BUIListLoadingRow({ label = 'Loading' }: { label?: string }) {
  const c = useBUITheme();
  return (
    <YStack
      height={72}
      items="center"
      justify="center"
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <Spinner size={24} color={c.primary} />
    </YStack>
  );
}

export function BUIListErrorRow({ children }: { children: string }) {
  const c = useBUITheme();
  return (
    <YStack minHeight={72} px={16} justify="center" items="center">
      <BUIText
        kind="label2"
        color={c.negative}
        textAlign="center"
        numberOfLines={2}
        accessibilityLiveRegion="polite"
      >
        {children}
      </BUIText>
    </YStack>
  );
}

export function BUIListRetryRow({
  message,
  buttonText = 'Retry',
  onRetry,
}: {
  message: string;
  buttonText?: string;
  onRetry: () => void;
}) {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  return (
    <XStack minHeight={72} px={16} gap={12} justify="center" items="center" flexWrap="wrap">
      <BUIText kind="body2" color={c.muted}>
        {message}
      </BUIText>
      <BUIButton appearance={appearance} size="small" onPress={onRetry}>
        {buttonText}
      </BUIButton>
    </XStack>
  );
}

export function BUIListSkeletonRow() {
  const c = useBUITheme();
  return (
    <YStack accessible accessibilityLabel="Loading account" accessibilityState={{ busy: true }}>
      <YStack importantForAccessibility="no-hide-descendants" accessible={false}>
        <BUIListRow
          minHeight={76}
          leading={<YStack width={44} height={44} rounded={22} bg={c.raised} />}
          title={
            <XStack flex={1} justify="space-between" gap={16}>
              <YStack width={84} height={19} bg={c.raised} />
              <YStack width={84} height={19} bg={c.raised} />
            </XStack>
          }
          subtitle={<YStack width={125} height={20} bg={c.raised} />}
        />
      </YStack>
    </YStack>
  );
}
