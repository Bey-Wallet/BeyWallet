import React, { useEffect, useState, useCallback, useRef } from 'react'
import { YStack, Text, Button, Spinner, H2, View } from 'tamagui'
import { Fingerprint } from '@tamagui/lucide-icons'
import { biometricService } from '../services/biometricService'
import * as Haptics from 'expo-haptics'
import { AppState, AppStateStatus } from 'react-native'
import { useAppTheme } from '../context/ThemeContext'
import BeyIcon from '~/components/icons/BeyIcon'

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { resolvedTheme } = useAppTheme()

    // Track whether we've auto-triggered so we only do it ONCE per mount
    const hasAutoTriggered = useRef(false)
    const isAuthRef = useRef(false) // mirror isAuthenticating for stable closure

    const handleAuthenticate = useCallback(async () => {
        // Guard: prevent concurrent auth attempts
        if (isAuthRef.current) return
        isAuthRef.current = true
        setIsAuthenticating(true)
        setError(null)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        try {
            const success = await biometricService.authenticateAsync('Unlock Bey Wallet to continue')
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                onUnlock()
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                setError('Authentication failed. Please try again.')
            }
        } catch (e) {
            setError('An error occurred during authentication.')
        } finally {
            isAuthRef.current = false
            setIsAuthenticating(false)
        }
    }, [onUnlock])

    // Auto-trigger biometric ONCE on mount — fast (300ms delay)
    useEffect(() => {
        if (hasAutoTriggered.current) return
        hasAutoTriggered.current = true

        const timer = setTimeout(() => {
            handleAuthenticate()
        }, 300)

        return () => clearTimeout(timer)
    }, [handleAuthenticate])

    // On foreground: only re-trigger if not already authenticating
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && !isAuthRef.current) {
                handleAuthenticate()
            }
        })

        return () => subscription.remove()
    }, [handleAuthenticate])

    return (
        <YStack flex={1} bg="$background" px="$3" py="$5" justify="space-between">
            {/* Top Section */}
            <YStack items="center" gap="$3" mt="$4">

                <YStack items="center" gap="$1">
                    <H2 fontSize="$8" fontWeight="700" color="$color">Bey Wallet is Locked</H2>
                    <Text color="$gray10" fontSize="$3">Your funds are securely protected</Text>
                </YStack>
            </YStack>

            {/* Middle Section - App Logo */}
            <YStack flex={1} justify="center" items="center">
                <View
                    width={160}
                    height={160}
                    rounded="$10"
                    bg="$color"
                    items="center"
                    justify="center"
                    overflow="hidden"

                    borderWidth={1}
                    borderColor="$borderColor"
                >
                    <BeyIcon size={100} color={resolvedTheme === 'dark' ? 'black' : 'white'} />
                </View>
            </YStack>

            {/* Bottom Section - Unlock Button */}
            <YStack gap="$4" height={200} items="center" justify="flex-end">
                {error && (
                    <View px="$2" items="center">

                        <Text color="$red10" bg="$red2" px="$4" py="$2" rounded="$2" text="center" fontSize="$3" fontWeight="600" animation="quick" enterStyle={{ opacity: 0, y: 10 }}>
                            {error}
                        </Text>
                    </View>
                )}
                <View items="center">

                    <Button
                        size="$5"
                        theme="accent"

                        onPress={handleAuthenticate}

                        icon={isAuthenticating ? <Spinner /> : <Fingerprint size={24} />}
                        fontSize="$6"
                        fontWeight="700"

                        rounded="$6"

                        pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    >
                        {isAuthenticating ? 'Authenticating...' : 'Unlock Wallet'}
                    </Button>
                </View>

                <Text text="center" color="$gray9" fontSize="$2" opacity={0.7}>
                    Supports FaceID, TouchID or Passcode
                </Text>
            </YStack>
        </YStack>
    )
}
