import React, { useState } from 'react'
import { YStack, Text, Button, H2, View, XStack } from 'tamagui'
import { BellRing, Check } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { notificationService } from '../../services/notificationService'

interface NotificationStepProps {
    onComplete: () => void
    onSkip: () => void
}

export function NotificationStep({ onComplete, onSkip }: NotificationStepProps) {
    const [isEnabling, setIsEnabling] = useState(false)
    const [isEnabled, setIsEnabled] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleEnable = async () => {
        if (isEnabling) return

        setIsEnabling(true)
        setError(null)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        try {
            const success = await notificationService.requestPermissions()
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                setIsEnabled(true)
                // Brief delay to show success state
                setTimeout(() => {
                    onComplete()
                }, 800)
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                setError('Permission denied or unavailable.')
                // Wait briefly and proceed anyway or let them skip manually
                setTimeout(() => {
                    onSkip()
                }, 1500)
            }
        } catch (e) {
            setError('An error occurred.')
            setTimeout(() => {
                onSkip()
            }, 1500)
        } finally {
            setIsEnabling(false)
        }
    }

    return (
        <YStack flex={1} bg="$background" px="$4" py="$6" justify="space-between">
            {/* Top spacer / Skip */}
            <XStack justify="flex-end" w="100%">
                {!isEnabled && (
                    <Button chromeless size="$3" onPress={onSkip} pressStyle={{ opacity: 0.5 }}>
                        <Text color="$gray10" fontWeight="600">Skip</Text>
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
                        <Check size={56} color="$green10" />
                    ) : (
                        <BellRing size={56} color="$blue10" />
                    )}
                </View>

                {/* Text */}
                <YStack items="center" gap="$2">
                    <H2 fontSize="$7" fontWeight="700" color="$color" text="center">
                        {isEnabled ? 'Notifications Enabled!' : 'Stay Updated'}
                    </H2>
                    <Text color="$gray10" fontSize="$3" text="center" px="$4">
                        {isEnabled
                            ? 'You will now receive alerts for incoming payments.'
                            : 'Enable notifications to know exactly when you receive payments.'}
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
                        icon={<BellRing size={24} />}
                        fontSize="$5"
                        fontWeight="700"
                        rounded="$4"
                        pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    >
                        {isEnabling ? 'Enabling...' : 'Enable Notifications'}
                    </Button>
                )}

                <Text color="$gray9" fontSize="$2" text="center">
                    Get alerted when you get paid
                </Text>
            </YStack>
        </YStack>
    )
}
