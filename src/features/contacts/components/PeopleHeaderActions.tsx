import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, Settings, Wifi, WifiOff } from '@tamagui/lucide-icons';
import { Button, Text, XStack } from 'tamagui';
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
    <XStack pr="$3" gap="$1" items="center">
      <Button
        unstyled
        height={32}
        px="$2.5"
        rounded="$10"
        bg={healthy ? '$green3' : '$gray3'}
        pressStyle={{ opacity: 0.75, scale: 0.97 }}
        onPress={() => open('/(modals)/nostr-diagnostics')}
        accessibilityLabel="Open Nostr diagnostics"
      >
        <XStack items="center" gap="$1.5">
          {connectionPercent === 0 ? (
            <WifiOff size={14} color="$red10" />
          ) : (
            <Wifi size={14} color={healthy ? '$green10' : '$yellow10'} />
          )}
          <Text fontSize="$2" fontWeight="800" color={healthy ? '$green11' : '$color'}>
            {connectionPercent === null ? '···' : `${connectionPercent}%`}
          </Text>
        </XStack>
      </Button>
      <Button
        circular
        size="$3"
        chromeless
        icon={<Activity size={19} color="$color" />}
        onPress={() => open('/(modals)/nostr-activity')}
        accessibilityLabel="Open Nostr activity"
      />
      <Button
        circular
        size="$3"
        chromeless
        icon={<Settings size={19} color="$color" />}
        onPress={() => open('/(modals)/nostr-settings')}
        accessibilityLabel="Open Nostr settings"
      />
    </XStack>
  );
});
