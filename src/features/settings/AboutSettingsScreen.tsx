import React, { useState } from 'react';
import { Text, YStack } from 'tamagui';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { RefreshCw, FileText } from '@tamagui/lucide-icons';
import BeyIcon from '~/shared/icons/BeyIcon';
import { settingsLinks, settingsLinkIcons } from './settingsCatalog';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
  openSettingsLink,
} from './components/SettingsLayout';

export function AboutSettingsScreen() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.2.0';
  const build =
    Application.nativeBuildVersion ?? Constants.expoConfig?.android?.versionCode?.toString();
  const link = (url: string) => {
    setError(false);
    void openSettingsLink(url).catch(() => setError(true));
  };
  return (
    <SettingsPage>
      <YStack items="center" gap="$3" py="$5">
        <BeyIcon size={72} color="$color" />
        <Text fontSize="$8" color="$color" fontWeight="700">
          Bey Wallet
        </Text>
        <Text color="$gray10">
          Version {version}
          {build ? ` (${build})` : ''}
        </Text>
      </YStack>
      <SettingsGroup>
        <SettingsRow
          title="Terms & privacy policy"
          icon={FileText}
          external
          onPress={() => link(settingsLinks.legal)}
        />
        <SettingsRow
          title="App updates"
          icon={RefreshCw}
          onPress={() => router.push('/(tabs)/settings/updates')}
        />
        <SettingsRow
          title="Visit website"
          icon={settingsLinkIcons.website}
          external
          onPress={() => link(settingsLinks.website)}
        />
        <SettingsRow
          title="GitHub"
          icon={settingsLinkIcons.github}
          external
          onPress={() => link(settingsLinks.github)}
        />
      </SettingsGroup>
      {error && <SettingsMessage error>Could not open the link. Please try again.</SettingsMessage>}
    </SettingsPage>
  );
}

export function HelpSettingsScreen() {
  const [error, setError] = useState(false);
  const link = (url: string) => {
    setError(false);
    void openSettingsLink(url).catch(() => setError(true));
  };
  return (
    <SettingsPage>
      <SettingsDescription>
        Get help with Bey Wallet, read the project documentation, or report an issue. Never include
        recovery phrases, private keys, backups, or ecash proofs in a support request.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsRow
          title="Help & documentation"
          icon={settingsLinkIcons.documentation}
          external
          onPress={() => link(settingsLinks.documentation)}
        />
        <SettingsRow
          title="Report an issue"
          icon={settingsLinkIcons.support}
          external
          onPress={() => link(settingsLinks.support)}
        />
      </SettingsGroup>
      {error && <SettingsMessage error>Could not open the link. Please try again.</SettingsMessage>}
    </SettingsPage>
  );
}
