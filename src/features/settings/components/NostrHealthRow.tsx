import React from 'react';
import { HeartPulse } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { Text, XStack } from 'tamagui';
import { nostrDiagnosticsService } from '~/services/wallet/nostrDiagnosticsService';
import { useNostrRelayStore } from '~/state/nostrRelayStore';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';

export function NostrHealthRow() {
  const relays = useNostrRelayStore((state) => state.relays);
  const health = useQuery({
    queryKey: ['settings', 'nostr-health', relays],
    queryFn: () => nostrDiagnosticsService.getDiagnostics(),
    staleTime: 30_000,
  });
  const value = health.isPending
    ? 'Checking…'
    : health.isError
      ? 'Unavailable'
      : health.data.overall === 'healthy'
        ? 'Healthy'
        : health.data.overall === 'degraded'
          ? 'Degraded'
          : 'Unhealthy';
  return (
    <XStack
      px={appSpacing.page}
      py={appSpacing.compact}
      minHeight={appDimensions.touchTarget}
      gap={appSpacing.gap}
      items="center"
      accessibilityLabel={`Nostr health, ${value}`}
    >
      <HeartPulse size={20} color="$color" />
      <Text flex={1} {...appTypography.label2} color="$color">
        Nostr health
      </Text>
      <Text fontSize="$3" color="$gray10" accessibilityLiveRegion="polite">
        {value}
      </Text>
    </XStack>
  );
}
