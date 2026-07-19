import React, { useEffect, useCallback, useRef } from 'react'
import { YStack, Button } from 'tamagui'
import { Fingerprint } from '@tamagui/lucide-icons'
import { biometricService } from '../services/biometricService'
import * as Haptics from 'expo-haptics'
import { AppState, AppStateStatus, StyleSheet, Image, Platform } from 'react-native'
import { useAppTheme } from '../context/ThemeContext'
import { BlurView } from 'expo-blur'

export function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
    const { resolvedTheme } = useAppTheme()

    const logoSource = resolvedTheme === 'dark'
        ? require('../assets/icons/bey-logo-white-transparent.png')
        : require('../assets/icons/bey-logo-black-transparent.png')

    // Track active authentication request to prevent overlapping promise races
    const isAuthenticatingRef = useRef(false)

    const handleAuthenticate = useCallback(async (force = false) => {
        if (!force && isAuthenticatingRef.current) {
            console.log('Biometric auth already in progress, skipping auto-trigger')
            return
        }
        
        console.log(`Starting biometric auth (force: ${force})`)
        isAuthenticatingRef.current = true
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        try {
            if (force) {
                console.log('Forcing auth: cancelling any active prompt first')
                await biometricService.cancelAuthenticate()
            }
            const success = await biometricService.authenticateAsync('Unlock Bey Wallet to continue')
            console.log('Biometric auth result success:', success)
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                onUnlock()
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            }
        } catch (e) {
            console.error('Error during biometric auth:', e)
        } finally {
            isAuthenticatingRef.current = false
            console.log('Biometric auth attempt finished')
        }
    }, [onUnlock])

    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            console.log('AppState changed to:', nextAppState)
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Cancel active prompt immediately
                await biometricService.cancelAuthenticate()
                isAuthenticatingRef.current = false
            } else if (nextAppState === 'active') {
                // Re-trigger biometrics automatically on resume
                handleAuthenticate()
            }
        }

        const subscription = AppState.addEventListener('change', handleAppStateChange)

        // Initial trigger on mount
        handleAuthenticate()

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
        >
            <BlurView
                intensity={80}
                tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            />
            <YStack
                flex={1}
                px="$4"
                py="$5"
                justify="space-between"
                items="center"
            >
                {/* Middle Section - App Logo */}
                <YStack flex={1} justify="center" items="center">
                    <Image
                        source={logoSource}
                        style={{ width: 90, height: 90 }}
                        resizeMode="contain"
                    />
                </YStack>

                {/* Bottom Section - Unlock Button */}
                <YStack gap="$4" pb="$8" width="100%" items="center" justify="flex-end">
                    <Button
                        size="$5"
                        theme="accent"
                        onPress={() => handleAuthenticate(true)}
                        icon={<Fingerprint size={20} />}
                        fontSize="$6"
                        fontWeight="700"
                        rounded="$10"
                        pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    >
                        Unlock
                    </Button>
                </YStack>
            </YStack>
        </YStack>
    )
}

