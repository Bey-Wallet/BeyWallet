import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, Clock, Radio, Settings, Signal } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { nostrDiagnosticsService } from '~/services/wallet/nostrDiagnosticsService';

export const PeopleHeaderActions = React.memo(function PeopleHeaderActions() {
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

  const open = (
    route: '/(modals)/nostr-diagnostics' | '/(modals)/nostr-activity' | '/(modals)/nostr-settings',
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route);
  };

  const healthy = connectionPercent !== null && connectionPercent >= 75;

  return (
    <XStack mr="$3" gap="$1" items="center" bg="$gray4" rounded="$12" p="$2">
      <AppButton
        variant="default"
        emphasis="tertiary"
        size="xsmall"
        icon={<Signal strokeWidth={2.5} size={16} />}
        onPress={() => open('/(modals)/nostr-diagnostics')}
        accessibilityLabel="Open Nostr diagnostics"
      >
        {connectionPercent === null ? '···' : `${connectionPercent}%`}
      </AppButton>
      <AppIconButton
        variant="default"
        emphasis="tertiary"
        size="xsmall"

        shape="circular"
        accessibilityLabel="Open Nostr activity"
        icon={<Clock size={19} color="$color" />}
        onPress={() => open('/(modals)/nostr-activity')}
      />
      <AppIconButton
        variant="default"
        emphasis="tertiary"
        size="xsmall"

        shape="circular"
        accessibilityLabel="Open Nostr settings"
        icon={<Settings size={19} color="$color" />}
        onPress={() => open('/(modals)/nostr-settings')}
      />
    </XStack>
  );
});
