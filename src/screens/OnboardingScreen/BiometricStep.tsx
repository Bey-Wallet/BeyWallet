import React, { useState } from 'react'
import { YStack, Text, Button, H2, View, XStack } from 'tamagui'
import { Fingerprint, ShieldCheck, Check } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { biometricService } from '../../services/biometricService'
import { useSettingsStore } from '../../store/settingsStore'

interface BiometricStepProps {
    onComplete: () => void
    onSkip: () => void
}

export function BiometricStep({ onComplete, onSkip }: BiometricStepProps) {
    const [isEnabling, setIsEnabling] = useState(false)
    const [isEnabled, setIsEnabled] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleEnable = async () => {
        if (isEnabling) return

        setIsEnabling(true)
        setError(null)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        try {
            const success = await biometricService.authenticateAsync('Enable biometric security for Bey Wallet')
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                setIsEnabled(true)
                await useSettingsStore.getState().setBiometricEnabled(true)
                // Brief delay to show success state
                setTimeout(() => {
                    onComplete()
                }, 800)
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                setError('Authentication failed. Please try again.')
            }
        } catch (e) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsEnabling(false)
        }
    }

    return (
        <YStack flex={1} bg="$background" px="$4" py="$6" justify="space-between">
            {/* Top spacer / Skip */}
            <XStack justify="flex-end" width="100%">
                {!isEnabled && (
                    <Button size="$3" rounded="$10" onPress={async () => {
                        await useSettingsStore.getState().setBiometricEnabled(false)
                        onSkip()
                    }} pressStyle={{ opacity: 0.5 }}>
                        Skip
                    </Button>
                )}
            </XStack>

            {/* Center Content */}
            <YStack items="center" gap="$8">
                {/* Icon */}
                <View
                    width={120}
                    height={120}
                    rounded="$10"
                    bg={isEnabled ? '$green3' : '$blue3'}
                    items="center"
                    justify="center"
                    borderWidth={2}
                    borderColor={isEnabled ? '$green9' : '$blue9'}
                >
                    {isEnabled ? (
                        <ShieldCheck size={56} color="$green10" />
                    ) : (
                        <Fingerprint size={56} color="$blue10" />
                    )}
                </View>

                {/* Text */}
                <YStack items="center" gap="$2">
                    <H2 fontSize="$7" fontWeight="700" color="$color">
                        {isEnabled ? 'Security Enabled!' : 'Secure Your Wallet'}
                    </H2>
                    <Text color="$gray10" fontSize="$3" text="center" px="$4">
                        {isEnabled
                            ? 'Your wallet is now protected with biometric authentication'
                            : 'Use Face ID, Touch ID, or passcode to protect your funds'}
                    </Text>
                </YStack>

                {/* Success indicator */}
                {isEnabled && (
                    <View
                        bg="$green9"
                        width={48}
                        height={48}
                        rounded="$10"
                        items="center"
                        justify="center"
                        animation="quick"
                        enterStyle={{ scale: 0, opacity: 0 }}
                    >
                        <Check size={28} color="white" />
                    </View>
                )}
            </YStack>

            {/* Bottom - Enable Button */}
            <YStack gap="$4" items="center" pb="$4">
                {error && (
                    <Text color="$red10" fontSize="$3" text="center">
                        {error}
                    </Text>
                )}

                {!isEnabled && (
                    <Button
                        size="$5"
                        theme="accent"
                        width="100%"
                        onPress={handleEnable}
                        disabled={isEnabling}
                        icon={<Fingerprint size={24} />}
                        fontSize="$5"
                        fontWeight="700"
                        rounded="$4"
                        pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    >
                        {isEnabling ? 'Enabling...' : 'Enable Biometric Security'}
                    </Button>
                )}

                <Text color="$gray9" fontSize="$2" text="center">
                    Required for wallet security
                </Text>
            </YStack>
        </YStack>
    )
}
