import React, { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native'
import { Stack, useRouter } from 'expo-router'
import { useTheme, YStack } from 'tamagui'
import * as Linking from 'expo-linking'
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
    const router = useRouter()

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

    // Global listener for deep links to handle direct ecash receiving/claiming
    useEffect(() => {
        const handleUrl = (url: string) => {
            console.log('[RootLayoutNav] Deep link received:', url);
            if (!url) return;

            let tokenFound = '';
            
            // Try to extract query parameter scannedToken or token
            const match = url.match(/[?&](scannedToken|token)=([^&]+)/);
            if (match && match[2]) {
                tokenFound = decodeURIComponent(match[2]);
            } else {
                // Check if the URL itself is the share link (ends with /c/#<hex> or /c#<hex>)
                const shareLinkMatch = url.match(/(https?:\/\/[^\/]+\/c\/?#[0-9a-fA-F]{64})/);
                if (shareLinkMatch) {
                    tokenFound = shareLinkMatch[0];
                } else {
                    // Fallback: Check if the URL contains a cashu token directly anywhere (e.g. cashuA... or cashuB...)
                    const cashuMatch = url.match(/(cashu[A-Za-z0-9_-]+)/);
                    if (cashuMatch && cashuMatch[1]) {
                        tokenFound = cashuMatch[1];
                    }
                }
            }

            if (tokenFound) {
                console.log('[RootLayoutNav] Global deep link parsed token, redirecting to receive modal:', tokenFound);
                // Ensure root tabs exist underneath the modal when launching directly via deep link
                router.replace('/(tabs)');
                setTimeout(() => {
                    router.push({
                        pathname: '/(modals)/receive',
                        params: { scannedToken: tokenFound }
                    });
                }, 300);
            }
        };

        // Listen for initial URL when app is opened via deep link
        Linking.getInitialURL().then((url) => {
            if (url) handleUrl(url);
        }).catch(err => {
            console.warn('[RootLayoutNav] Failed to get initial URL:', err);
        });

        // Listen for new incoming URLs
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

        return () => {
            subscription.remove();
        };
    }, [router]);

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

