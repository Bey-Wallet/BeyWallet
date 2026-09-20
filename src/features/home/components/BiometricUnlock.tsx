import React, { useState } from 'react';
import { Button, YStack, Text, XStack, Spinner } from 'tamagui';
import { Fingerprint, Lock, Unlock, ShieldCheck } from '@tamagui/lucide-icons';
import { biometricService } from '~/services/platform/biometricService';
import * as Haptics from 'expo-haptics';

export function BiometricUnlock() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleAuthenticate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAuthenticating(true);
    setAuthStatus('idle');

    const success = await biometricService.authenticateAsync('Test app unlock');

    setIsAuthenticating(false);
    if (success) {
      setAuthStatus('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reset after 3 seconds
      setTimeout(() => setAuthStatus('idle'), 3000);
    } else {
      setAuthStatus('failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setAuthStatus('idle'), 3000);
    }
  };

  return (
    <YStack
      gap="$4"
      width="100%"
      p="$4"
      bg="$background"
      rounded="$4"
      borderWidth={1}
      items="center"
      borderColor={
        authStatus === 'success' ? '$green10' : authStatus === 'failed' ? '$red10' : '$borderColor'
      }
    >
      <XStack items="center" gap="$2">
        <ShieldCheck size={20} color={authStatus === 'success' ? '$green10' : '$blue10'} />
        <Text fontSize="$4" fontWeight="600" color="$color">
          Security
        </Text>
      </XStack>

      <Button
        size="$5"
        theme={authStatus === 'success' ? 'green' : authStatus === 'failed' ? 'red' : 'blue'}
        onPress={handleAuthenticate}
        disabled={isAuthenticating}
        icon={
          isAuthenticating ? (
            <Spinner color="$color" />
          ) : authStatus === 'success' ? (
            <Unlock size={24} />
          ) : (
            <Lock size={24} />
          )
        }
        iconAfter={<Fingerprint size={24} />}
      >
        {isAuthenticating
          ? 'Authenticating...'
          : authStatus === 'success'
            ? 'Wallet Unlocked'
            : authStatus === 'failed'
              ? 'Try Again'
              : 'Unlock Wallet'}
      </Button>

      {authStatus !== 'idle' && (
        <XStack items="center" justify="center" gap="$2">
          {authStatus === 'success' ? (
            <Text color="$green10" fontWeight="500">
              Authentication Successful!
            </Text>
          ) : (
            <Text color="$red10" fontWeight="500">
              Authentication Failed
            </Text>
          )}
        </XStack>
      )}

      <Text fontSize="$2" color="$gray10">
        Use your device biometrics to secure your wallet
      </Text>
    </YStack>
  );
}
