import React, { useState, useRef, useEffect } from 'react';
import { YStack, XStack, Text, Button, H1, View, Switch, Separator } from 'tamagui';
import {
  ChevronRight,
  Fingerprint,
  Sprout,
  WifiOff,
  Globe,
  User,
  Landmark,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { biometricService } from '~/services/platform/biometricService';
import { useSettingsStore } from '~/state/settingsStore';
import { networkService } from '~/services/platform/networkService';
import Blockies from '~/shared/ui/Blockies';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

interface PermissionsStepProps {
  initialUsername: string;
  npub: string;
  onComplete: (username: string, biometricEnabled: boolean, skipUsername: boolean) => void;
}

export function PermissionsStep({ initialUsername, npub, onComplete }: PermissionsStepProps) {
  const insets = useSafeAreaInsets();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isRequestingBio, setIsRequestingBio] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [skipUsername, setSkipUsername] = useState(false);
  const sheetRef = useRef<AppBottomSheetRef>(null);

  // Check network status on mount
  useEffect(() => {
    networkService.isOffline().then((offline) => {
      setIsOffline(offline);
      if (offline) {
        setSkipUsername(true); // Force skip when offline
      }
    });
  }, []);

  const handleBiometricToggle = async (checked: boolean) => {
    if (!checked) {
      setBiometricEnabled(false);
      await useSettingsStore.getState().setBiometricEnabled(false);
      return;
    }

    setIsRequestingBio(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const success = await biometricService.authenticateAsync(
        'Enable biometric security for Bey Wallet',
      );
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBiometricEnabled(true);
        await useSettingsStore.getState().setBiometricEnabled(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setBiometricEnabled(false);
      }
    } catch {
      setBiometricEnabled(false);
    } finally {
      setIsRequestingBio(false);
    }
  };

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!biometricEnabled) {
      sheetRef.current?.present();
    } else {
      onComplete(initialUsername, true, skipUsername);
    }
  };

  const handleEnableFromSheet = async () => {
    sheetRef.current?.dismiss();
    setIsRequestingBio(true);
    try {
      const success = await biometricService.authenticateAsync(
        'Enable biometric security for Bey Wallet',
      );
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBiometricEnabled(true);
        await useSettingsStore.getState().setBiometricEnabled(true);
        onComplete(initialUsername, true, skipUsername);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setBiometricEnabled(false);
      }
    } catch {
      setBiometricEnabled(false);
    } finally {
      setIsRequestingBio(false);
    }
  };

  const handleSkipFromSheet = () => {
    sheetRef.current?.dismiss();
    onComplete(initialUsername, false, skipUsername);
  };

  // Truncate npub for display
  const shortNpub = npub ? `${npub.slice(0, 10)}...${npub.slice(-6)}` : 'npub...';

  return (
    <YStack
      flex={1}
      bg="$background"
      px="$4"
      justify="space-between"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <YStack gap="$0" mt="$2">
        <H1 fontSize="$8" text="center" fontWeight="800" letterSpacing={-0.5} color="$color">
          Profile & Security
        </H1>
      </YStack>

      {/* Username / Profile Card (centered in screen) */}
      <YStack flex={1} items="center" justify="center" gap="$2">
        <XStack justify="center" mb="$3">
          <Blockies seed={npub || 'anon'} size={10} scale={7} style={{ borderRadius: 10 }} />
        </XStack>

        {/* Primary identity: username or npub */}
        {skipUsername || isOffline ? (
          <>
            <Text
              fontSize="$7"
              px="$2"
              rounded="$3"
              py="$1"
              fontWeight="800"
              text="center"
              color="$accent5"
            >
              {shortNpub}
            </Text>
            <Text fontSize="$2" color="$gray10" text="center" mt="$1" px="$4">
              Your decentralized identity (npub). You can claim a @bey.cash username anytime.
            </Text>
          </>
        ) : (
          <>
            <Text
              fontSize="$6"
              px="$2"
              rounded="$3"
              py="$1"
              fontWeight="800"
              text="center"
              color="$black"
              bg="yellow"
            >
              {initialUsername}@bey.cash
            </Text>
            <Text fontSize="$2" color="$gray10" text="center" mt="$1">
              Deterministic nickname (changeable in settings)
            </Text>
          </>
        )}
      </YStack>

      {/* Bottom Section - Settings & Finish Button */}
      <YStack gap="$4" mb="$4">
        {/* Toggles Group Card */}
        <YStack bg="$gray2" rounded="$6" borderWidth={0} overflow="hidden">
          {/* Biometrics Toggle */}
          <XStack p="$3.5" justify="space-between" items="center">
            <XStack gap="$3" items="center" flex={1}>
              <Fingerprint size={24} color={biometricEnabled ? '$accent10' : '$gray10'} />
              <YStack flex={1}>
                <Text fontWeight="700" fontSize="$5">
                  Biometric Security
                </Text>
              </YStack>
            </XStack>
            <Switch
              size="$3"
              checked={biometricEnabled}
              onCheckedChange={handleBiometricToggle}
              disabled={isRequestingBio}
              backgroundColor={biometricEnabled ? '$green10' : '$gray5'}
            >
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>

          <Separator borderColor="$borderColor" />

          {/* Username Claim Toggle (only when online) */}
          {!isOffline && (
            <>
              <XStack p="$3.5" justify="space-between" items="center">
                <XStack gap="$3" items="center" flex={1}>
                  <User size={24} color={!skipUsername ? '$accent10' : '$gray10'} />
                  <YStack flex={1}>
                    <Text fontWeight="700" fontSize="$5">
                      Claim @bey.cash
                    </Text>
                    <Text fontSize="$2" color="$gray10">
                      {skipUsername ? 'Using npub only' : `${initialUsername}@bey.cash`}
                    </Text>
                  </YStack>
                </XStack>
                <Switch
                  size="$3"
                  checked={!skipUsername}
                  onCheckedChange={(checked) => setSkipUsername(!checked)}
                  backgroundColor={!skipUsername ? '$green10' : '$gray5'}
                >
                  <Switch.Thumb animation="quick" />
                </Switch>
              </XStack>

              <Separator borderColor="$borderColor" />
            </>
          )}

          {/* Mint / Offline Status Row */}
          <XStack p="$3.5" items="center" gap="$3">
            {isOffline ? (
              <>
                <WifiOff size={24} color="$orange10" />
                <YStack flex={1}>
                  <Text fontWeight="700" fontSize="$5">
                    Offline Mode
                  </Text>
                  <Text fontSize="$2" color="$gray10">
                    No mints connected. Add mints on the home screen when online.
                  </Text>
                </YStack>
              </>
            ) : (
              <>
                <Landmark size={24} color="$gray10" />
                <YStack flex={1}>
                  <Text fontWeight="700" fontSize="$5">
                    Standard Default Mint
                  </Text>
                  <Text fontSize="$2" color="$gray10">
                    Minibits Mint (sat) will be automatically trusted
                  </Text>
                </YStack>
              </>
            )}
          </XStack>
        </YStack>

        {/* Offline Info Badge */}
        {isOffline && (
          <XStack bg="$orange3" rounded="$4" p="$3" gap="$2" items="center">
            <WifiOff size={16} color="$orange10" />
            <Text fontSize="$2" color="$orange11" flex={1}>
              You're offline. Wallet will be created locally. Username and mints can be added once
              online.
            </Text>
          </XStack>
        )}

        {/* Finish Button */}
        <Button
          size="$5"
          theme="accent"
          width="100%"
          onPress={handleFinish}
          iconAfter={<ChevronRight size={18} />}
          fontSize="$5"
          fontWeight="700"
          rounded="$6"
          pressStyle={{ scale: 0.98, opacity: 0.9 }}
        >
          Finish & Open Wallet
        </Button>
      </YStack>

      {/* Premium Biometrics Bottom Sheet */}
      <AppBottomSheet ref={sheetRef}>
        <YStack p="$4" gap="$5" items="center" pb="$8">
          {/* Shield Icon Graphic */}
          <View bg="$gray5" p="$4" rounded={100} mb="$1">
            <Fingerprint size={50} color="$accent5" />
          </View>

          {/* Text Content */}
          <YStack gap="$2" items="center">
            <Text fontWeight="800" fontSize="$6" text="center" color="$color">
              Enable Biometric Security?
            </Text>
            <Text fontSize="$3" color="$gray10" text="center" px="$3" lineHeight={20}>
              We highly recommend protecting your wallet with Face ID / Touch ID to prevent
              unauthorized payments and secure your funds.
            </Text>
          </YStack>

          {/* Actions */}
          <YStack gap="$3" width="100%">
            <Button
              size="$5"
              theme="accent"
              fontWeight="700"
              rounded="$4"
              onPress={handleEnableFromSheet}
            >
              Enable Biometrics
            </Button>
            <Button
              size="$5"

              onPress={handleSkipFromSheet}
            >
              <Text fontWeight="600">Skip & Finish</Text>
            </Button>
          </YStack>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
