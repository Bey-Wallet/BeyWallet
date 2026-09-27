import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Button, ScrollView, Text, View, XStack, YStack } from 'tamagui';
import { CheckCircle2, RefreshCw, XCircle } from '@tamagui/lucide-icons';
import { useToastController } from '@tamagui/toast';
import { SafeFlex } from '~/shared/ui/Flex';
import {
  nostrDiagnosticsService,
  type NostrDiagnosticSnapshot,
} from '~/services/wallet/nostrDiagnosticsService';

export default function NostrDiagnosticsScreen() {
  const toast = useToastController();
  const [snapshot, setSnapshot] = useState<NostrDiagnosticSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await nostrDiagnosticsService.getDiagnostics());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const repair = useCallback(
    async (kind: 'profile' | 'inbox' | 'relays') => {
      setRepairing(kind);
      try {
        const ok =
          kind === 'profile'
            ? await nostrDiagnosticsService.repairProfile()
            : kind === 'inbox'
              ? await nostrDiagnosticsService.republishInboxRelayList()
              : (nostrDiagnosticsService.reconnectRelays(), true);
        toast.show(ok ? 'Repair requested' : 'Repair failed');
        await refresh();
      } finally {
        setRepairing(null);
      }
    },
    [refresh, toast],
  );

  return (
    <SafeFlex fill bg="$background">
      <Stack.Screen options={{ title: 'Nostr Diagnostics' }} />
      <ScrollView>
        <YStack gap="$4" p="$4" pb="$8">
          <XStack justify="space-between" items="center">
            <YStack>
              <Text fontSize="$6" fontWeight="900">
                Connection health
              </Text>
              <Text color="$gray10">
                {snapshot
                  ? `Last checked ${new Date(snapshot.checkedAt).toLocaleTimeString()}`
                  : 'Not checked yet'}
              </Text>
            </YStack>
            <Button circular icon={<RefreshCw size={18} />} onPress={refresh} disabled={loading} />
          </XStack>

          <CheckRow
            label="NIP-05 resolves to this wallet"
            ok={snapshot?.nip05.matches}
            detail={snapshot?.nip05.identifier || 'No NIP-05 configured'}
          />
          <CheckRow
            label="Kind-0 profile is published"
            ok={snapshot?.profile.present && snapshot.profile.nip05Matches}
            detail={snapshot?.profile.nip05 || 'Profile missing or NIP-05 differs'}
          />
          <Button onPress={() => repair('profile')} disabled={!!repairing}>
            Repair profile
          </Button>
          <CheckRow
            label="Kind-10050 inbox relays are published"
            ok={snapshot?.inboxRelayList.published && snapshot.inboxRelayList.matches}
            detail={`${snapshot?.inboxRelayList.relays.length || 0} relays advertised`}
          />
          <Button onPress={() => repair('inbox')} disabled={!!repairing}>
            Republish inbox relay list
          </Button>

          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="900">
              Relays
            </Text>
            {(snapshot?.relays || []).map((relay) => (
              <CheckRow
                key={relay.url}
                label={relay.url}
                ok={relay.reachable}
                detail={relay.reachable ? 'Reachable' : relay.error || 'Unavailable'}
              />
            ))}
          </YStack>
          <Button onPress={() => repair('relays')} disabled={!!repairing}>
            Reconnect relays
          </Button>
        </YStack>
      </ScrollView>
    </SafeFlex>
  );
}

function CheckRow({ label, detail, ok }: { label: string; detail: string; ok?: boolean }) {
  return (
    <XStack bg="$gray3" rounded="$5" p="$3" gap="$3" items="center">
      <View>
        {ok ? <CheckCircle2 size={20} color="$green10" /> : <XCircle size={20} color="$red10" />}
      </View>
      <YStack flex={1}>
        <Text fontWeight="800">{label}</Text>
        <Text fontSize="$2" color="$gray10">
          {detail}
        </Text>
      </YStack>
    </XStack>
  );
}
