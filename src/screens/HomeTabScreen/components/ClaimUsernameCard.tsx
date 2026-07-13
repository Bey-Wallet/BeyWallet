import React from "react";
import { YStack, XStack, Text, Button, H6, View } from "tamagui";
import { AtSign, X } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSettingsStore } from "~/store/settingsStore";
import { useNip05Lookup } from "~/hooks/useNip05Lookup";

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
    router.push("/(modals)/nostr-username");
  };

  return (
    <YStack
      width="100%"
      p="$3.5"
      rounded="$5"
      bg="$color2"
      gap="$2.5"
      pressStyle={{ opacity: 0.9, scale: 0.99 }}
      onPress={handleNavigate}
    >
      <XStack items="flex-start" justify="space-between">
        <XStack items="flex-start" gap="$2.5" flex={1}>
          <View p="$2" bg="$purple5" rounded="$3" items="center" justify="center">
            <AtSign size={20} color="$purple10" />
          </View>
          <YStack flex={1}>
            <H6 color="$color" fontWeight="800">
              Claim Your Username
            </H6>
            <Text fontSize="$2" overflow="hidden" color="$gray10" lineHeight={16}>
              Get a free @bey.cash Nostr identifier linked to your public key.
            </Text>
          </YStack>
        </XStack>
        <Button
          size="$2.5"
          circular
          icon={<X size={18} color="$gray10" />}
          onPress={handleDismiss}
          pressStyle={{ opacity: 0.7 }}
        />
      </XStack>
    </YStack>
  );
}
