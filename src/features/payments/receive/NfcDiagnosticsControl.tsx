import React, { useRef, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { Text, XStack, YStack } from 'tamagui';
import { nfcService } from '~/services/platform/nfcService';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppButton } from '~/shared/ui/AppButton';

export function NfcDiagnosticsControl() {
  const sheet = useRef<AppBottomSheetRef>(null);
  const [report, setReport] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!__DEV__ || Platform.OS !== 'android') return null;

  const refresh = async () => {
    const diagnostics = await nfcService.getDiagnostics();
    const next = diagnostics
      ? `Bey ${Application.nativeApplicationVersion ?? 'unknown'} (${Application.nativeBuildVersion ?? 'unknown'})\nAndroid ${diagnostics.androidVersion}\nModel ${diagnostics.deviceModel}\n${diagnostics.report}`
      : 'NFC diagnostics unavailable. Install the diagnostic development APK.';
    setReport(next);
    return next;
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage('Could not complete diagnostics action. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppButton
        emphasis="text-only"
        size="xsmall"
        disabled={busy}
        onPress={() => {
          sheet.current?.present();
          void run(async () => {
            await refresh();
          });
        }}
      >
        NFC diagnostics
      </AppButton>
      <AppBottomSheet ref={sheet}>
        <YStack p="$4" gap="$3">
          <Text fontSize="$6" fontWeight="600">
            NFC diagnostics
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <AppButton
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await refresh();
                })
              }
            >
              Refresh
            </AppButton>
            <AppButton
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await Clipboard.setStringAsync(await refresh());
                  setMessage('Report copied');
                })
              }
            >
              Copy report
            </AppButton>
            <AppButton
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await nfcService.clearDiagnostics();
                  await refresh();
                })
              }
            >
              Clear
            </AppButton>
          </XStack>
          <ScrollView style={{ maxHeight: 300 }}>
            <Text selectable fontSize="$2">
              {report}
            </Text>
          </ScrollView>
          {message ? <Text>{message}</Text> : null}
        </YStack>
      </AppBottomSheet>
    </>
  );
}
