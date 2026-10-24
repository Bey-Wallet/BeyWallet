import { AppIconButton } from '~/shared/ui/AppIconButton';
import React from 'react';
import { YStack, XStack, Text, H6, View } from 'tamagui';
import { AtSign, X } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';

export default function ClaimUsernameCard() {
  const router = useRouter();
  const { nip05, loading } = useNip05Lookup();
  const usernameClaimDismissedAt = useSettingsStore((s) => s.usernameClaimDismissedAt);
  const setUsernameClaimDismissedAt = useSettingsStore((s) => s.setUsernameClaimDismissedAt);

  // If already registered or loading, do not show the card
  if (nip05 || loading) {
    return null;
  }

  // If dismissed, do not show the card ever again
  const isDismissed = !!usernameClaimDismissedAt;

  if (isDismissed) {
    return null;
  }

  const handleDismiss = async (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setUsernameClaimDismissedAt(Date.now());
  };

  const handleNavigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/nostr-username');
  };

  return (
    <YStack
      width="100%"
      p="$3.5"
      rounded="$6"
      bg="$buttonDefaultSecondary"
      gap="$2.5"
      hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
      pressStyle={{ bg: '$buttonDefaultSecondaryPress', opacity: 0.9, scale: 0.99 }}
      onPress={handleNavigate}
    >
      <XStack items="flex-start" justify="space-between">
        <XStack items="flex-start" gap="$2.5" flex={1}>
          <View p="$2" items="center" justify="center">
            <AtSign size={20} color="$iconSecondary" />
          </View>
          <YStack flex={1}>
            <H6 color="$color" fontWeight="600">
              Claim Your Username
            </H6>
            <Text fontSize="$2" overflow="hidden" color="$gray10" lineHeight={16}>
              Get a free @bey.cash Nostr identifier linked to your public key.
            </Text>
          </YStack>
        </XStack>
        <AppIconButton
          variant="default"
          emphasis="tertiary"
          size="xxsmall"

          shape="circular"
          accessibilityLabel="Dismiss notice"
          icon={<X size={18} />}
          onPress={handleDismiss}
        />
      </XStack>
    </YStack>
  );
}
