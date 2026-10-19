import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ModalHeaderTitle } from '~/shared/ui/ModalHeaderTitle';
import { settingsTitles } from './settingsCatalog';
import { settingsReturnPath } from './settingsNavigation';

export default function SettingsStack() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Stack
      screenOptions={({ route, navigation }) => ({
        title: settingsTitles[route.name] ?? 'Settings',
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background.val },
        headerTintColor: theme.color.val,
        contentStyle: { backgroundColor: theme.background.val },
        headerTitle: ({ children }) => <ModalHeaderTitle>{children}</ModalHeaderTitle>,
        headerLeft: () => (
          <AppIconButton
            accessibilityLabel="Back"
            variant="default"
            emphasis="tertiary"
            size="xsmall"
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
