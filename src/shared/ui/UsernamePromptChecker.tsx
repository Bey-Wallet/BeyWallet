import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useRef, useState } from 'react';

import { Text, YStack, useTheme, XStack, View } from 'tamagui';
import { useRouter } from 'expo-router';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AtSign } from '@tamagui/lucide-icons';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import { useNfcPresentation } from '~/features/nfc/NfcSheetHost';

export function UsernamePromptChecker() {
  const nfc = useNfcPresentation();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const router = useRouter();
  const theme = useTheme();
  const { isOnboarded } = useOnboardingStore();
  const isSettingsInitialized = useSettingsStore((state) => state.initialized);
  const storedNip05 = useSettingsStore((state) => state.nip05);
  const { nip05, loading } = useNip05Lookup();
  const [hasPrompted, setHasPrompted] = useState(false);
  const usernameClaimDismissedAt = useSettingsStore((state) => state.usernameClaimDismissedAt);
  const setUsernameClaimDismissedAt = useSettingsStore(
    (state) => state.setUsernameClaimDismissedAt,
  );

  useEffect(() => {
    // Wait for fully onboarded, settings loaded, lookup finished, or already dismissed
    if (
      !isOnboarded ||
      nfc.visible ||
      !isSettingsInitialized ||
      loading ||
      hasPrompted ||
      usernameClaimDismissedAt
    )
      return;

    // Give it a brief delay before checking
    const timeout = setTimeout(() => {
      // Check BOTH the remote lookup AND the local stored value.
      // If the user just registered, storedNip05 will be set even if
      // the server cache hasn't refreshed nostr.json yet.
      if (!nip05 && !storedNip05) {
        sheetRef.current?.present();
        setHasPrompted(true); // Don't prompt again in this session
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [
    isOnboarded,
    nfc.visible,
    isSettingsInitialized,
    loading,
    nip05,
    storedNip05,
    hasPrompted,
    usernameClaimDismissedAt,
  ]);

  return (
    <AppBottomSheet ref={sheetRef} snapPoints={['43%']}>
      <YStack p="$4" gap="$4" items="center" flex={1}>
        <View p="$3" bg="$blue9" rounded={1000} mb="$2">
          <AtSign size={32} color="$onAccent" />
        </View>
        <Text fontSize={20} fontWeight="bold" textAlign="center">
          Claim Your Free Username
        </Text>
        <Text fontSize={16} color="$color11" textAlign="center" marginBottom="$4">
          It looks like you haven't claimed a bey.cash username yet. Claim one now to make it easier
          for friends to send you money!
        </Text>
        <XStack space="$3" width="100%" justifyContent="center" marginTop="auto">
          <AppButton
            variant="default"
            emphasis="text-only"
            size="medium"
            flex={1}
            onPress={() => {
              setUsernameClaimDismissedAt(Date.now());
              sheetRef.current?.dismiss();
            }}
          >
            Maybe Later
          </AppButton>
          <AppButton
            variant="branded"
            emphasis="primary"
            size="medium"
            flex={1}
            onPress={() => {
              sheetRef.current?.dismiss();
              setTimeout(() => {
                router.push('/(modals)/nostr-username');
              }, 300);
            }}
          >
            Claim Now
          </AppButton>
        </XStack>
      </YStack>
    </AppBottomSheet>
  );
}
