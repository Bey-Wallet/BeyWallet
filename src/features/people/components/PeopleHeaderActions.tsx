import React from 'react';
import { useRouter } from 'expo-router';
import { SlidersHorizontal } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
import { AppIconButton } from '~/shared/ui/AppIconButton';

export const PeopleHeaderActions = React.memo(function PeopleHeaderActions() {
  const router = useRouter();
  return (
    <XStack pr="$4" items="center">
      <AppIconButton
        variant="default"
        emphasis="tertiary"
        size="xsmall"
        shape="circular"
        accessibilityLabel="Open Nostr settings"
        icon={SlidersHorizontal}
        onPress={() => router.push('/(modals)/nostr-settings')}
      />
    </XStack>
  );
});
