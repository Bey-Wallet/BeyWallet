import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useRecoveryHandoff } from '~/shared/hooks/useRecoveryHandoff';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
import { Spinner } from '~/shared/ui/Spinner';
import { useTheme, YStack } from 'tamagui';
import * as Linking from 'expo-linking';
import { useAppTheme } from '~/shared/theme/ThemeContext';
import { LockOverlay } from '~/shared/ui/LockOverlay';

import { useAuthStore } from '~/state/authStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useCocoEvents } from '~/shared/hooks/useCocoEvents';

import { useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { notificationService } from '~/services/platform/notificationService';
import { isNfcIntent } from '~/features/nfc/nativeIntent';
import { nfcFlow } from '~/features/nfc/nfcFlow';

// Lazy-load global checkers — they don't need to mount during the critical startup paint
const LazyOtaUpdateChecker = React.lazy(() =>
  import('~/shared/ui/OtaUpdateChecker').then((m) => ({ default: m.OtaUpdateChecker })),
);
const LazyUsernamePromptChecker = React.lazy(() =>
  import('~/shared/ui/UsernamePromptChecker').then((m) => ({ default: m.UsernamePromptChecker })),
);

export function RootLayoutNav() {
  const { resolvedTheme } = useAppTheme();
  const theme = useTheme();
  const { isAuthenticated, setAuthenticated, lock, markBackgrounded } = useAuthStore();
  const { isOnboarded } = useOnboardingStore();
  const biometricEnabled = useSettingsStore((state) => state.biometricEnabled);
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const handingOff = useRecoveryHandoff();

  // Subscribe to coco events for automatic balance/history updates
  useCocoEvents();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Only lock if onboarded and moving from active to background
      // Note: We deliberately do NOT lock on 'inactive' because native OS permission
      // prompts (like Camera/FaceID) push the app into 'inactive' state temporarily.
      if (isOnboarded && appState.current === 'active' && nextAppState === 'background') {
        markBackgrounded();
        void nfcFlow.background().then(() => lock());
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [lock, markBackgrounded, isOnboarded]);

  // Global listener for deep links to handle direct ecash receiving/claiming
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (useRecoverySessionStore.getState().session?.phase === 'recovering') return;
      if (!url) return;
      if (isNfcIntent(url)) return;

      let tokenFound = '';
      let paymentRequestFound = '';

      const cleanedUrl = url.trim();

      // 1. Check if the URL is a bey.cash web link
      if (cleanedUrl.includes('bey.cash/c') || cleanedUrl.includes('bey.cash/r')) {
        const hashIndex = cleanedUrl.indexOf('#');
        if (hashIndex !== -1) {
          const hashValue = cleanedUrl.slice(hashIndex + 1).trim();
          if (cleanedUrl.includes('/c')) {
            tokenFound = `https://bey.cash/c/#${hashValue}`;
          } else if (cleanedUrl.includes('/r')) {
            if (hashValue.toLowerCase().startsWith('creq')) {
              paymentRequestFound = hashValue;
            } else if (hashValue.toLowerCase().startsWith('lnbc')) {
              paymentRequestFound = hashValue;
            } else {
              console.log(
                '[RootLayoutNav] Deep link parsed request ID, redirecting to receive request screen:',
                hashValue,
              );
              router.replace('/(tabs)');
              setTimeout(() => {
                if (useRecoverySessionStore.getState().session?.phase === 'recovering') return;
                router.push({
                  pathname: '/(modals)/receive',
                  params: { requestId: hashValue },
                });
              }, 300);
              return;
            }
          }
        } else {
          const parts = cleanedUrl.split('/');
          const lastPart = parts[parts.length - 1].trim();
          if (lastPart) {
            const lower = lastPart.toLowerCase();
            if (lower.startsWith('cashu')) {
              tokenFound = lastPart;
            } else if (lower.startsWith('creq') || lower.startsWith('lnbc')) {
              paymentRequestFound = lastPart;
            }
          }
        }
      }

      // 2. Query parameters fallback
      if (!tokenFound && !paymentRequestFound) {
        const match = cleanedUrl.match(/[?&](scannedToken|token|creq|invoice)=([^&]+)/);
        if (match && match[2]) {
          const parsed = decodeURIComponent(match[2]);
          if (parsed.toLowerCase().startsWith('creq') || parsed.toLowerCase().startsWith('lnbc')) {
            paymentRequestFound = parsed;
          } else {
            tokenFound = parsed;
          }
        }
      }

      // 3. Fallback scheme regex matching
      if (!tokenFound && !paymentRequestFound) {
        const cashuMatch = cleanedUrl.match(/(cashu[A-Za-z0-9_-]+)/);
        if (cashuMatch) {
          tokenFound = cashuMatch[1];
        } else {
          const reqMatch = cleanedUrl.match(/(creq[a-zA-Z0-9]+)/i);
          if (reqMatch) {
            paymentRequestFound = reqMatch[1];
          } else {
            const lnMatch = cleanedUrl.match(/(lnbc[a-zA-Z0-9]+)/i);
            if (lnMatch) {
              paymentRequestFound = lnMatch[1];
            }
          }
        }
      }

      if (tokenFound) {
        console.log('[RootLayoutNav] Redirecting to receive modal with token:', tokenFound);
        router.replace('/(tabs)');
        setTimeout(() => {
          if (useRecoverySessionStore.getState().session?.phase === 'recovering') return;
          router.push({
            pathname: '/(modals)/receive',
            params: { scannedToken: tokenFound },
          });
        }, 300);
      } else if (paymentRequestFound) {
        console.log(
          '[RootLayoutNav] Redirecting to send modal with payment request:',
          paymentRequestFound,
        );
        router.replace('/(tabs)');
        setTimeout(() => {
          if (useRecoverySessionStore.getState().session?.phase === 'recovering') return;
          router.push({
            pathname: '/(modals)/send',
            params: { paymentRequest: paymentRequestFound },
          });
        }, 300);
      }
    };

    // Listen for initial URL when app is opened via deep link
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleUrl(url);
      })
      .catch((err) => {
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
    ...(resolvedTheme === 'dark' ? DarkTheme : DefaultTheme),
    // Registered static faces already contain their weight; avoid Android fallback/synthesis.
    fonts: {
      regular: { fontFamily: 'InterTextRegular', fontWeight: 'normal' as const },
      medium: { fontFamily: 'InterTextMedium', fontWeight: 'normal' as const },
      bold: { fontFamily: 'InterTextSemiBold', fontWeight: 'normal' as const },
      heavy: { fontFamily: 'InterTextSemiBold', fontWeight: 'normal' as const },
    },
    colors: {
      ...(resolvedTheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background?.val,
      card: theme.background?.val,
    },
  };
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    NavigationBar.setStyle(isDark ? 'dark' : 'light');
  }, [isDark]);

  // Only show lock overlay if onboarded, not authenticated, and biometric is enabled
  const showLockOverlay = isOnboarded && !isAuthenticated && biometricEnabled;

  return (
    <NavThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <YStack flex={1} bg="$background">
        <Stack
          screenOptions={{
            headerTitleStyle: { fontFamily: 'InterTextSemiBold', fontWeight: 'normal' },
            headerBackTitleStyle: { fontFamily: 'InterTextRegular' },
            contentStyle: {
              backgroundColor: theme.background?.val,
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

              presentation: 'modal',
              animation: 'ios_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          />
        </Stack>
        {handingOff && (
          <YStack position="absolute" inset={0} bg="$background" items="center" justify="center">
            <Spinner />
          </YStack>
        )}

        {/* Lock overlay - only shows when onboarded and locked */}
        {showLockOverlay && <LockOverlay onUnlock={() => setAuthenticated(true)} />}

        {/* Global checkers — lazy-loaded after main UI is painted */}
        <React.Suspense fallback={null}>
          <LazyOtaUpdateChecker />
          <LazyUsernamePromptChecker />
        </React.Suspense>
      </YStack>
    </NavThemeProvider>
  );
}
