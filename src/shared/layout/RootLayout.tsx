import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { Provider } from '~/shared/ui/Provider';
import { RootLayoutNav } from '~/shared/layout/RootLayoutNav';
import { initService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingScreen } from '~/features/onboarding';
import { NostrPaymentReceived } from '~/shared/ui/NostrPaymentReceived';
import { NostrClaimSheet } from '~/shared/ui/NostrClaimSheet';

const queryClient = new QueryClient();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export function RootLayout() {
  const initialize = useWalletStore((state) => state.initialize);
  const isInitializing = useWalletStore((state) => state.isInitializing);
  const { isOnboarded, isCheckingOnboarding, checkOnboardingStatus } = useOnboardingStore();
  const [walletExists, setWalletExists] = useState<boolean | null>(null);

  // Cache manager in state instead of re-computing inside render body
  const [manager, setManager] = useState<any>(null);

  const [loaded, error] = useFonts({
    BaselGroteskBook: require('~/assets/fonts/Inter-Tight-Medium.otf'),
    BaselGroteskMedium: require('~/assets/fonts/Inter-Tight-SemiBold.otf'),
    BaselGroteskBold: require('~/assets/fonts/Inter-Tight_Bold.otf'),
    Mono: require('~/assets/fonts/Mono.otf'),
    Oswald: require('~/assets/fonts/Oswald.otf'),
  });

  // Check onboarding status and wallet existence on mount
  useEffect(() => {
    const checkStatus = async () => {
      const onboarded = await checkOnboardingStatus();
      const exists = await initService.walletExists();
      setWalletExists(exists);
      console.log(`[RootLayout] Startup check — onboarded: ${onboarded}, walletExists: ${exists}`);
      if (exists && !onboarded) {
        console.log(
          '[RootLayout] ⚠️ Wallet found but marked as not onboarded. User may see welcome screen.',
        );
      }
    };
    checkStatus();
  }, [checkOnboardingStatus]);

  // A wallet can be created while onboarding is open, after the startup check has completed.
  useEffect(() => {
    if (!isOnboarded) return;
    initService.walletExists().then(setWalletExists);
  }, [isOnboarded]);

  // Initialize wallet only if onboarded and wallet exists
  useEffect(() => {
    if (isOnboarded && walletExists) {
      console.log('[RootLayout] ✅ Mnemonic found, initializing Coco...');
      initialize();
    }
  }, [isOnboarded, walletExists, initialize]);

  // Cache manager once initialization completes
  useEffect(() => {
    if (!isInitializing && isOnboarded && walletExists) {
      try {
        setManager(initService.getManager());
      } catch (e) {
        setManager(null);
      }
    }
  }, [isInitializing, isOnboarded, walletExists]);

  // Hide splash when ready
  useEffect(() => {
    const isReady = (loaded || error) && !isCheckingOnboarding && walletExists !== null;
    const isAppReady = !isOnboarded || (!isInitializing && isOnboarded);

    if (isReady && isAppReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, isCheckingOnboarding, walletExists, isOnboarded, isInitializing]);

  // Still loading fonts or checking onboarding
  if (!loaded && !error) {
    return null;
  }

  if (isCheckingOnboarding || walletExists === null) {
    return null;
  }

  // Show onboarding if not completed or no wallet exists
  if (!isOnboarded || !walletExists) {
    return (
      <Providers cocoManager={null}>
        <OnboardingScreen />
      </Providers>
    );
  }

  return (
    <Providers cocoManager={manager}>
      <RootLayoutNav />
      <NostrClaimSheet />
      <NostrPaymentReceived />
    </Providers>
  );
}

const Providers = ({ children, cocoManager }: { children: React.ReactNode; cocoManager: any }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider cocoManager={cocoManager}>{children}</Provider>
    </QueryClientProvider>
  );
};
