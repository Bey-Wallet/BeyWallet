import React from "react";
import { YStack, XStack, Text, Button, H6, View } from "tamagui";
import { AlertTriangle, X } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSettingsStore } from "~/store/settingsStore";
import { biometricService } from "~/services/biometricService";

export default function BackupWarningCard() {
  const router = useRouter();
  const seedBackedUp = useSettingsStore((s) => s.seedBackedUp);
  const backupDismissedAt = useSettingsStore((s) => s.backupDismissedAt);
  const setBackupDismissedAt = useSettingsStore((s) => s.setBackupDismissedAt);

  if (seedBackedUp) {
    return null;
  }

  // Check if dismissed in the last 7 days (7 * 24 * 60 * 60 * 1000 ms)
  const isDismissed =
    backupDismissedAt &&
    Date.now() - backupDismissedAt < 7 * 24 * 60 * 60 * 1000;

  if (isDismissed) {
    return null;
  }

  const handleDismiss = async (e: any) => {
    // Prevent navigating to the backup screen when clicking dismiss button
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setBackupDismissedAt(Date.now());
  };

  const handleNavigate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const authed = await biometricService.authenticateAsync('Authenticate to backup seed phrase');
    if (authed) {
      await setBackupDismissedAt(Date.now());
      router.push("/(modals)/backup-seed");
    }
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
          <View p="$2" bg="$orange5" rounded="$3" items="center" justify="center">
            <AlertTriangle size={20} color="$orange10" />
          </View>
          <YStack flex={1}>
            <H6 color="$color" fontWeight="800">
              Secure Your Wallet
            </H6>
            <Text fontSize="$2" overflow="hidden" color="$gray10" lineHeight={16}>
              Back up your seed phrase now to protect your funds.
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
