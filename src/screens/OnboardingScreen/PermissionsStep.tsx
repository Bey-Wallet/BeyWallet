import React, { useState, useRef } from 'react';
import { YStack, XStack, Text, Button, H1, View, Switch, Separator } from 'tamagui';
import { ShieldCheck, ChevronRight, Sprout } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { biometricService } from '../../services/biometricService';
import { useSettingsStore } from '../../store/settingsStore';
import Blockies from '~/components/UI/Blockies';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';

interface PermissionsStepProps {
    initialUsername: string;
    npub: string;
    onComplete: (username: string, biometricEnabled: boolean) => void;
}

export function PermissionsStep({ initialUsername, npub, onComplete }: PermissionsStepProps) {
    const insets = useSafeAreaInsets();
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [isRequestingBio, setIsRequestingBio] = useState(false);
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const handleBiometricToggle = async (checked: boolean) => {
        if (!checked) {
            setBiometricEnabled(false);
            await useSettingsStore.getState().setBiometricEnabled(false);
            return;
        }

        setIsRequestingBio(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const success = await biometricService.authenticateAsync('Enable biometric security for Bey Wallet');
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
            onComplete(initialUsername, true);
        }
    };

    const handleEnableFromSheet = async () => {
        sheetRef.current?.dismiss();
        setIsRequestingBio(true);
        try {
            const success = await biometricService.authenticateAsync('Enable biometric security for Bey Wallet');
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setBiometricEnabled(true);
                await useSettingsStore.getState().setBiometricEnabled(true);
                onComplete(initialUsername, true);
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
        onComplete(initialUsername, false);
    };

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            justifyContent="space-between"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            {/* Header */}
            <YStack gap="$0" mt="$2">
                <H1 fontSize="$8" text="center" fontWeight="800" letterSpacing={-0.5} color="$color">
                    Profile & Security
                </H1>
            </YStack>

            {/* Username / Profile Card (centered in screen) */}
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
                <XStack justifyContent="center" mb="$3">
                    <Blockies
                        seed={npub || 'anon'}
                        size={10}
                        scale={7}
                        style={{ borderRadius: 10 }}
                    />
                </XStack>
                <Text fontSize="$6" px="$2" borderRadius="$3" py="$1" fontWeight="800" textAlign="center" color="$black" backgroundColor="yellow">
                    {initialUsername}@bey.cash
                </Text>
                <Text fontSize="$2" color="$gray10" textAlign="center" mt="$1">
                    Deterministic nickname (changeable in settings)
                </Text>
            </YStack>

            {/* Bottom Section - Settings & Finish Button */}
            <YStack gap="$4" mb="$4">
                {/* Toggles Group Card */}
                <YStack
                    bg="$gray2"
                    rounded="$5"
                    borderWidth={0}
                    overflow="hidden"
                >
                    {/* Biometrics Toggle */}
                    <XStack
                        p="$3.5"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <XStack gap="$3" alignItems="center" flex={1}>
                            <ShieldCheck size={24} color={biometricEnabled ? "$accent10" : "$gray10"} />
                            <YStack flex={1}>
                                <Text fontWeight="700" fontSize="$5">Biometric Security</Text>
                            </YStack>
                        </XStack>
                        <Switch
                            size="$3"
                            checked={biometricEnabled}
                            onCheckedChange={handleBiometricToggle}
                            disabled={isRequestingBio}
                            backgroundColor={biometricEnabled ? "$green10" : "$gray5"}
                        >
                            <Switch.Thumb animation="quick" />
                        </Switch>
                    </XStack>

                    <Separator borderColor="$borderColor" />

                    {/* Default Mint Acknowledgment */}
                    <XStack p="$3.5" alignItems="center" gap="$3">
                        <Sprout size={24} color="$green10" />
                        <YStack flex={1}>
                            <Text fontWeight="700" fontSize="$5">Standard Default Mint</Text>
                            <Text fontSize="$2" color="$gray10">Minibits Mint (sat) will be automatically trusted</Text>
                        </YStack>
                    </XStack>
                </YStack>

                {/* Finish Button */}
                <Button
                    size="$5"
                    theme="accent"
                    width="100%"
                    onPress={handleFinish}
                    iconAfter={<ChevronRight size={18} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$5"
                    pressStyle={{ scale: 0.98, opacity: 0.9 }}
                >
                    Finish & Open Wallet
                </Button>
            </YStack>

            {/* Premium Biometrics Bottom Sheet */}
            <AppBottomSheet ref={sheetRef}>
                <YStack p="$4" gap="$5" alignItems="center" pb="$8">
                    {/* Shield Icon Graphic */}
                    <View bg="$gray5" p="$4" borderRadius={100} mb="$1">
                        <ShieldCheck size={50} color="$accent5" />
                    </View>

                    {/* Text Content */}
                    <YStack gap="$2" alignItems="center">
                        <Text fontWeight="800" fontSize="$6" textAlign="center" color="$color">
                            Enable Biometric Security?
                        </Text>
                        <Text fontSize="$3" color="$gray10" textAlign="center" px="$3" lineHeight={20}>
                            We highly recommend protecting your wallet with Face ID / Touch ID to prevent unauthorized payments and secure your funds.
                        </Text>
                    </YStack>

                    {/* Actions */}
                    <YStack gap="$3" width="100%">
                        <Button
                            size="$5"
                           theme="accent"
                            fontWeight="700"
                            borderRadius="$4"
                            onPress={handleEnableFromSheet}
                        >
                            Enable Biometrics
                        </Button>
                        <Button
                            size="$5"
                            
                            onPress={handleSkipFromSheet}
                        >
                            <Text  fontWeight="600">Skip & Finish</Text>
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}
