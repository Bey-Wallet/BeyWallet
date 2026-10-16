import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Signal, SlidersHorizontal } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { nostrDiagnosticsService } from '~/services/wallet/nostrDiagnosticsService';

export const PeopleConnectionStatus = React.memo(function PeopleConnectionStatus() {
  const router = useRouter();
  const [connectionPercent, setConnectionPercent] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const check = async () => {
        try {
          const snapshot = await nostrDiagnosticsService.getDiagnostics();
          if (!active) return;
          const reachable = snapshot.relays.filter((relay) => relay.reachable).length;
          setConnectionPercent(
            snapshot.relays.length ? Math.round((reachable / snapshot.relays.length) * 100) : 0,
          );
        } catch {
          if (active) setConnectionPercent(0);
        }
      };
      void check();
      const timer = setInterval(check, 30_000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  return (
    <AppButton
      variant="default"
      emphasis="tertiary"
      size="xsmall"
      icon={<Signal strokeWidth={2.5} size={16} />}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(modals)/nostr-diagnostics');
      }}
      accessibilityLabel="Open Nostr diagnostics"
    >
      {connectionPercent === null ? '···' : `${connectionPercent}%`}
    </AppButton>
  );
});

export const PeopleHeaderActions = React.memo(function PeopleHeaderActions() {
  const router = useRouter();

  return (
    <XStack pr="$4" items="center">
      <AppIconButton
        variant="default"
        emphasis="tertiary"
        size="xsmall"
        shape="circular"
        accessibilityLabel="Open Nostr settings"
        icon={<SlidersHorizontal />}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(modals)/nostr-settings');
        }}
      />
    </XStack>
  );
});
