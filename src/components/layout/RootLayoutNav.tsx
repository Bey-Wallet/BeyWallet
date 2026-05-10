import React, { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { useTheme, YStack } from 'tamagui'
import { useAppTheme } from '../../context/ThemeContext'
import { LockOverlay } from '../LockOverlay'

import { useAuthStore } from '../../store/authStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useCocoEvents } from '../../hooks/useCocoEvents'
import { notificationService } from '../../services/notificationService'

// Lazy-load global checkers — they don't need to mount during the critical startup paint
const LazyOtaUpdateChecker = React.lazy(() =>
    import('../OtaUpdateChecker').then(m => ({ default: m.OtaUpdateChecker }))
);
const LazyUsernamePromptChecker = React.lazy(() =>
    import('../UsernamePromptChecker').then(m => ({ default: m.UsernamePromptChecker }))
);

export function RootLayoutNav() {
    const { resolvedTheme } = useAppTheme()
    const theme = useTheme()
    const { isAuthenticated, setAuthenticated, lock, markBackgrounded } = useAuthStore()
    const { isOnboarded } = useOnboardingStore()
    const { biometricEnabled } = useSettingsStore()
    const appState = useRef(AppState.currentState)

    // Subscribe to coco events for automatic balance/history updates
    useCocoEvents();

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            // Only lock if onboarded and moving from active to background
            // Note: We deliberately do NOT lock on 'inactive' because native OS permission 
            // prompts (like Camera/FaceID) push the app into 'inactive' state temporarily.
            if (isOnboarded && appState.current === 'active' && nextAppState === 'background') {
                markBackgrounded()
                lock()
            }

            appState.current = nextAppState
        })

        return () => {
            subscription.remove()
        }
    }, [lock, markBackgrounded, isOnboarded])

    const navigationTheme = {
        ...resolvedTheme === 'dark' ? DarkTheme : DefaultTheme,
        colors: {
            ...(resolvedTheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
            background: theme.background.val,
        },
    }

    // Only show lock overlay if onboarded, not authenticated, and biometric is enabled
    const showLockOverlay = isOnboarded && !isAuthenticated && biometricEnabled

    return (
        <NavThemeProvider value={navigationTheme}>
            <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
            <YStack flex={1}>
                <Stack
                    screenOptions={{
                        contentStyle: {
                            backgroundColor: theme.background.val,
                        },
                    }}
                >
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            headerShown: false,
                        }}
                    />

                    <Stack.Screen
                        name="(modals)"
                        options={{
                            headerShown: false,

                            presentation: "modal",
                            animation: "ios_from_right",
                            gestureEnabled: true,
                            gestureDirection: 'horizontal',
                        }}
                    />

                    <Stack.Screen
                        name="modal"
                        options={{
                            title: 'Tamagui + Expo',
                            presentation: 'formSheet',
                            animation: 'slide_from_right',
                            gestureEnabled: true,
                            gestureDirection: 'horizontal',
                        }}
                    />
                </Stack>

                {/* Lock overlay - only shows when onboarded and locked */}
                {showLockOverlay && (
                    <LockOverlay onUnlock={() => setAuthenticated(true)} />
                )}
                
                {/* Global checkers — lazy-loaded after main UI is painted */}
                <React.Suspense fallback={null}>
                    <LazyOtaUpdateChecker />
                    <LazyUsernamePromptChecker />
                </React.Suspense>
            </YStack>
        </NavThemeProvider>
    )
}

