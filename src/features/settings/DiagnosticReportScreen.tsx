import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Text, YStack } from 'tamagui';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Copy, RefreshCw } from '@tamagui/lucide-icons';
import { AppButton } from '~/shared/ui/AppButton';
import { nostrService } from '~/services/wallet/nostrService';
import { useNostrRelayStore } from '~/state/nostrRelayStore';
import { formatDiagnosticReport } from './diagnosticReport';
import { useSettingsOperation } from './hooks/useSettingsOperation';
import { SettingsDescription, SettingsMessage, SettingsPage } from './components/SettingsLayout';

function createReport() {
  let relays: { configured: number; connected: number } | null = null;
  try {
    const configured = useNostrRelayStore.getState().relays;
    const connections = nostrService.getRelayConnectionStatus();
    relays = {
      configured: configured.length,
      connected: configured.filter((url) => connections[url] === true).length,
    };
  } catch {
    // Missing connection state should not prevent copying basic app information.
  }
  return formatDiagnosticReport({
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
    build:
      Application.nativeBuildVersion ??
      (Platform.OS === 'android'
        ? Constants.expoConfig?.android?.versionCode?.toString()
        : Platform.OS === 'ios'
          ? Constants.expoConfig?.ios?.buildNumber
          : null) ??
      null,
    platform: Platform.OS,
    relays,
  });
}

export function DiagnosticReportScreen() {
  const [report, setReport] = useState(createReport);
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsDescription>
        Preview the report before copying it for support. It contains app version, build, platform,
        and relay connection counts. Keys, proofs, tokens, balances, contacts, and mint or relay
        URLs are excluded. Nothing is sent automatically.
      </SettingsDescription>
      <YStack bg="$gray2" rounded="$6" p="$4">
        <Text selectable fontSize={13} color="$color">
          {report}
        </Text>
      </YStack>
      <SettingsDescription>
        Connection counts are a snapshot. Refresh for the latest status.
      </SettingsDescription>
      <AppButton icon={Copy} loading={task.busy} onPress={() => void task.copy(report)}>
        Copy diagnostic report
      </AppButton>
      <AppButton
        icon={RefreshCw}
        emphasis="secondary"
        disabled={task.busy}
        onPress={() => {
          task.clear();
          setReport(createReport());
        }}
      >
        Refresh report
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}
