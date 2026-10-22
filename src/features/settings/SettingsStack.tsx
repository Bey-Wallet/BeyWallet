import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';
import { settingsTitles } from './settingsCatalog';
import { settingsReturnPath } from './settingsNavigation';

export default function SettingsStack() {
  const theme = useTheme();
  const router = useRouter();
  const headerOptions = useScreenHeaderOptions();
  return (
    <Stack
      screenOptions={({ route, navigation }) => ({
        title: settingsTitles[route.name] ?? 'Settings',
        ...headerOptions,
        contentStyle: { backgroundColor: theme.background.val },
        headerLeft: () => (
          <HeaderIconButton
            accessibilityLabel="Back"
            icon={ArrowLeft}
            onPress={() => {
              if (route.name === 'index') router.navigate(settingsReturnPath());
              else if (navigation.getState().index > 0) navigation.goBack();
              else router.replace('/(tabs)/settings');
            }}
          />
        ),
      })}
    />
  );
}
