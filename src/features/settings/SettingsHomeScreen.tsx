import React from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { Bell, ChevronRight, Landmark, Zap } from '@tamagui/lucide-icons';
import Blockies from '~/shared/ui/Blockies';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import { settingsCategories, CircleHelp, Info, type SettingsCategory } from './settingsCatalog';
import { settingsReturnPath } from './settingsNavigation';
import {
  SettingsGroup,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from './components/SettingsLayout';

export function SettingsScreen() {
  const router = useRouter();
  const npub = useSettingsStore((state) => state.npub);
  const { nip05, username, status, refresh } = useNip05Lookup();
  const navigate = (path: string) => router.push(`/(tabs)/settings/${path}` as Href);
  useFocusEffect(
    React.useCallback(() => {
      refresh();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        router.navigate(settingsReturnPath());
        return true;
      });
      return () => subscription.remove();
    }, [router, refresh]),
  );
  const category = (key: SettingsCategory) => (
    <SettingsRow
      key={key}
      title={settingsCategories[key].title}
      icon={settingsCategories[key].icon}
      onPress={() => navigate(key)}
    />
  );
  return (
    <SettingsPage>
      <AppPressable
        rounded="$6"
        bg="$gray2"
        p="$4"
        minHeight={80}
        flexDirection="row"
        items="center"
        gap="$3"
        accessibilityLabel="Profile"
        hoverStyle={{ bg: '$gray3' }}
        pressStyle={{ bg: '$gray3' }}
        onPress={() => navigate('identity')}
      >
        <Blockies seed={npub || 'bey-wallet'} size={10} scale={4} style={{ borderRadius: 20 }} />
        <YStack flex={1} gap="$1">
          <XStack gap="$2" items="center">
            <Text fontSize="$6" fontWeight="700" color="$color" numberOfLines={1} flexShrink={1}>
              {username ? `@${username}` : nip05 ? `@${nip05.split('@')[0]}` : 'Profile'}
            </Text>
            {status === 'verified' && !!nip05 && <Nip05VerifiedBadge size={18} />}
          </XStack>
          <Text fontSize="$3" color="$gray10" numberOfLines={1}>
            {nip05 || (npub ? `${npub.slice(0, 12)}…${npub.slice(-6)}` : 'Username & addresses')}
          </Text>
        </YStack>
        <ChevronRight size={20} color="$gray10" />
      </AppPressable>
      <SettingsSection title="PREFERENCES">
        <SettingsGroup>
          {category('preferences')}
          <SettingsRow
            title="Notifications"
            icon={Bell}
            onPress={() => navigate('notifications')}
          />
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection title="WALLET">
        <SettingsGroup>
          <SettingsRow
            title="Mints"
            icon={Landmark}
            onPress={() => router.push('/(modals)/mints')}
          />
          <SettingsRow title="Lightning" icon={Zap} onPress={() => navigate('lightning-address')} />
          {category('backup')}
          {category('security')}
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection title="MORE">
        <SettingsGroup>
          {category('advanced')}
          <SettingsRow title="Help & support" icon={CircleHelp} onPress={() => navigate('help')} />
          <SettingsRow title="About Bey" icon={Info} onPress={() => navigate('about')} />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
