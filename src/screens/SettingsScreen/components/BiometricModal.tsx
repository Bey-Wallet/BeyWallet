import React, { forwardRef, useState } from 'react';
import { YStack, XStack, H3, Circle, Text, Switch } from 'tamagui';
import { Fingerprint } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { useSettingsStore } from '~/store/settingsStore';
import * as Haptics from 'expo-haptics';
import { biometricService } from '~/services/biometricService';

export const BiometricModal = forwardRef<AppBottomSheetRef>((_, ref) => {
    const { biometricEnabled, setBiometricEnabled } = useSettingsStore();
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const handleToggle = async (val: boolean) => {
        if (isAuthenticating) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsAuthenticating(true);

        try {
            if (val) {
                const success = await biometricService.authenticateAsync('Enable biometric security for Bey Wallet');
                if (success) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setBiometricEnabled(true);
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
            } else {
                const success = await biometricService.authenticateAsync('Authenticate to disable biometric security');
                if (success) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setBiometricEnabled(false);
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
            }
        } finally {
            setIsAuthenticating(false);
        }
    };

    return (
        <AppBottomSheet ref={ref} snapPoints={['35%']}>
            <YStack p="$4" gap="$4">
                <XStack items="center" gap="$3">
                    <Circle p="$2" bg="$blue5">
                        <Fingerprint size={24} color="$blue10" />
                    </Circle>
                    <H3>Biometric Security</H3>
                </XStack>

                <YStack gap="$4" py="$2">
                    <XStack justify="space-between" items="center" p="$3" bg="$gray2" rounded="$4">
                        <YStack flex={1} pr="$4">
                            <Text fontSize="$4" fontWeight="600">App Lock</Text>
                            <Text fontSize="$3" color="$gray10" mt="$1">
                                Require Face ID, Touch ID, or passcode to open your wallet.
                            </Text>
                        </YStack>
                        <Switch
                            size="$3"
                            checked={biometricEnabled}
                            onCheckedChange={handleToggle}
                            disabled={isAuthenticating}
                        >
                            <Switch.Thumb animation="bouncy" />
                        </Switch>
                    </XStack>
                </YStack>
            </YStack>
        </AppBottomSheet>
    );
});

BiometricModal.displayName = 'BiometricModal';
