import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Info } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';
import { settingsTitles } from './settingsCatalog';
import { settingsReturnPath } from './settingsNavigation';
import { isDevelopmentClient } from '~/shared/utils/developmentClient';
import { buiRouteNames } from './bui/buiRoutes';
import { InfoSheet } from '~/shared/components/info-sheets/InfoSheet';
import { infoSheetContent, type InfoTopic } from '~/shared/components/info-sheets/infoSheetContent';
import type { BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { feedbackNavigationGuard } from '~/services/feedback/navigationGuard';

// These destinations currently have no trailing action. Explicit screen options
// still take precedence over this navigator default if a destination adds one.
export const settingsInfoTopics: Readonly<Record<string, InfoTopic>> = {
  'get-change': 'offline-change',
  'optimize-wallet': 'optimize',
  'fallback-mint': 'fallback-mint',
  'lightning-address': 'lightning-address',
  'lightning-address-mint': 'receiving-mint',
  'receiving-policy': 'receiving-policy',
  proofs: 'proofs',
  'verify-proofs': 'verify-proofs',
  'mint-backup': 'mint-backup',
  'export-backup': 'export-backup',
  'restore-backup': 'restore-backup',
  'recover-funds': 'recover-funds',
  relays: 'relays',
};

export default function SettingsStack() {
  const theme = useTheme();
  const router = useRouter();
  const headerOptions = useScreenHeaderOptions();
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const infoSheet = useRef<BUISheetRef>(null);
  const busy = useSyncExternalStore(
    feedbackNavigationGuard.subscribe,
    feedbackNavigationGuard.getSnapshot,
    feedbackNavigationGuard.getSnapshot,
  );
  useEffect(() => {
    if (infoTopic) infoSheet.current?.present();
  }, [infoTopic]);
  return (
    <>
      <Stack
        initialRouteName="index"
        screenListeners={{ blur: () => infoSheet.current?.dismiss() }}
        screenOptions={({ route, navigation }) => ({
          title: settingsTitles[route.name] ?? 'Settings',
          ...headerOptions,
          contentStyle: { backgroundColor: theme.background.val },
          headerRight: settingsInfoTopics[route.name]
            ? () => (
                <AppIconButton
                  variant="default"
                  emphasis="ghost"
                  size="medium"
                  shape="circular"
                  iconSize={22}
                  icon={Info}
                  accessibilityLabel={`${infoSheetContent[settingsInfoTopics[route.name]].title} information`}
                  disabled={busy}
                  onPress={() => setInfoTopic(settingsInfoTopics[route.name])}
                />
              )
            : undefined,
          headerLeft: () => (
            <HeaderIconButton
              accessibilityLabel="Back"
              disabled={busy}
              icon={ArrowLeft}
              onPress={() => {
                if (route.name === 'index') router.navigate(settingsReturnPath());
                else if (navigation.getState().index > 0) navigation.goBack();
                else router.replace('/(tabs)/settings');
              }}
            />
          ),
        })}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={isDevelopmentClient()}>
          {buiRouteNames.map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
      </Stack>
      {infoTopic && (
        <InfoSheet
          ref={infoSheet}
          topic={infoTopic}
          busy={busy}
          onClose={() => setInfoTopic(null)}
        />
      )}
    </>
  );
}
