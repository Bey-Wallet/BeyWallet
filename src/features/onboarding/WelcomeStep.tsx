import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect } from 'react';
import { YStack, View } from 'tamagui';
import { Image } from 'expo-image';
import { Alert, AppState, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '~/shared/ui/AppText';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import BeyIcon from '~/shared/icons/BeyIcon';

interface WelcomeStepProps {
  busy?: boolean;
  isSettingUp?: boolean;
  isDeleting?: boolean;
  onCreateWallet: () => void;
  onImportWallet: () => void;
  hasSavedWallet?: boolean;
  onOpenSavedWallet?: () => void;
  onDeleteSavedWallet?: () => void;
}

export function WelcomeStep({
  busy = false,
  isSettingUp = false,
  isDeleting = false,
  onCreateWallet,
  onImportWallet,
  hasSavedWallet = false,
  onOpenSavedWallet,
  onDeleteSavedWallet,
}: WelcomeStepProps) {
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const float = useSharedValue(0);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  useEffect(() => {
    const updateMotion = (state: string) => {
      cancelAnimation(float);
      float.value = 0;
      if (state === 'active' && focused && !busy && !reducedMotion) {
        float.value = withRepeat(
          withTiming(-4, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        );
      }
    };
    updateMotion(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateMotion);
    return () => {
      subscription.remove();
      cancelAnimation(float);
    };
  }, [busy, float, focused, reducedMotion]);

  const handleCreate = () => {
    onCreateWallet();
  };

  const handleImport = () => {
    onImportWallet();
  };

  return (
    <YStack flex={1} bg="$background" px="$4" justify="space-between">
      {/* Top spacer */}
      <View />

      {/* Center - Logo and Title */}

      <YStack
        height={400}
        width="100%"
        bg="$gray2"
        rounded="$6"
        items="center"
        justify="center"
        position="relative"
        overflow="hidden"
      >
        <Animated.View
          entering={FadeIn.duration(350).reduceMotion(ReduceMotion.System)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            source={require('~/assets/images/Moving-clouds.gif')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
        <Animated.View style={logoStyle} accessible={false}>
          <BeyIcon color="black" size={50} />
        </Animated.View>
      </YStack>

      {/* Bottom - CTAs */}
      <YStack gap="$3" justify="center" items="center" pb="$4">
        <YStack items="center" gap="$2">
          <AppText variant="title1" accessibilityRole="header" text="center">
            {hasSavedWallet ? 'Finish Setup' : 'Bitcoin, like cash.'}
          </AppText>
          <AppText variant="body1" tone="secondary" pb="$4" text="center" px="$4">
            {hasSavedWallet
              ? "We found a wallet setup in progress. Let's finish initializing it."
              : 'Send and receive Bitcoin with ecash.'}
          </AppText>
        </YStack>

        {hasSavedWallet ? (
          <>
            <AppButton
              haptic
              disabled={busy}
              variant="critical"
              loading={isDeleting}
              loadingText="Deleting wallet…"
              emphasis="secondary"
              size="large"
              width="100%"
              onPress={() => {
                Alert.alert(
                  'Delete Wallet',
                  'Are you sure you want to delete the saved wallet and start over? This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDeleteSavedWallet },
                  ],
                );
              }}
            >
              Delete & Start Over
            </AppButton>
            <AppButton
              disabled={busy}
              variant="default"
              emphasis="primary"
              size="large"
              width="100%"
              onPress={onOpenSavedWallet}
              loading={isSettingUp}
              loadingText="Setting up wallet…"
            >
              Open saved wallet
            </AppButton>
          </>
        ) : (
          <>
            <AppButton
              haptic
              disabled={busy}
              variant="default"
              emphasis="primary"
              size="large"
              width="100%"
              onPress={handleCreate}
            >
              Create a wallet
            </AppButton>
            <AppButton
              disabled={busy}
              variant="default"
              emphasis="secondary"
              size="large"
              width="100%"
              onPress={handleImport}
            >
              I already have a wallet
            </AppButton>
          </>
        )}
      </YStack>
    </YStack>
  );
}
