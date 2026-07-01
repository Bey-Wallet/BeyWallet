import React, { useEffect, useState, useCallback, useRef } from 'react'
import { YStack, Text, Button, Spinner, H2, View } from 'tamagui'
import { Fingerprint } from '@tamagui/lucide-icons'
import { biometricService } from '../services/biometricService'
import * as Haptics from 'expo-haptics'
import { AppState, AppStateStatus, StyleSheet } from 'react-native'
import BeyIcon from '~/components/icons/BeyIcon'

export function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && !hasAutoTriggered.current) {
                hasAutoTriggered.current = true
                handleAuthenticate()
            }
        }

        const subscription = AppState.addEventListener('change', handleAppStateChange)

        // Initial trigger on mount
        if (!hasAutoTriggered.current) {
            hasAutoTriggered.current = true
            handleAuthenticate()
        }

        return () => {
            subscription.remove()
        }
    }, [handleAuthenticate])

    return (
        <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            style={StyleSheet.absoluteFill}
            z={9999}
            bg="$background"
            px="$4"
            py="$5"
            justify="space-between"
            items="center"
        >
            {/* Middle Section - App Logo */}
            <YStack flex={1} justify="center" items="center">
                <BeyIcon size={120} />
            </YStack>

            {/* Bottom Section - Unlock Button */}
            <YStack gap="$4" pb="$8" width="100%" items="center" justify="flex-end">
                <Button
                    size="$4"

                    theme="accent"
                    onPress={handleAuthenticate}
                    disabled={isAuthenticating}
                    icon={isAuthenticating ? <Spinner /> : <Fingerprint size={20} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$10"
                    pressStyle={{ scale: 0.98, opacity: 0.9 }}
                >
                    {isAuthenticating ? 'Authenticating...' : (error ? 'Try Again' : 'Unlock')}
                </Button>
            </YStack>
        </YStack>
    )
}
