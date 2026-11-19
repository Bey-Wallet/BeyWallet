import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { Provider } from '~/shared/ui/Provider';
import { RootLayoutNav } from '~/shared/layout/RootLayoutNav';
import { initService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useSettingsStore } from '~/state/settingsStore';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '~/shared/utils/queryClient';
import { OnboardingScreen } from '~/features/onboarding';
import { NostrPaymentReceived } from '~/features/nostr/components/NostrPaymentReceived';
import { NostrClaimSheet } from '~/features/nostr/components/NostrClaimSheet';
import { NfcSheetHost } from '~/features/nfc/NfcSheetHost';
import { useAutomaticMintBackup } from '~/shared/hooks/useAutomaticMintBackup';
import { hydrateBitcoinPriceCache } from '~/shared/utils/bitcoinPriceQueryCache';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import { Text, YStack } from 'tamagui';
import { useFileRestoreStore } from '~/state/fileRestoreStore';
import { fileRestoreService } from '~/services/wallet/fileRestoreService';
import { FileRestoreGate } from '~/features/settings/FileRestoreGate';
import { getDb } from '~/storage/sqlite/sqliteStorage';
import {
  assertEncryptedStorageAvailable,
  DatabaseEncryptionUnavailableError,
  WalletDeletionPendingError,
} from '~/storage/sqlite/encryptedDatabase';

hydrateBitcoinPriceCache(queryClient);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export function RootLayout() {
  const restorePhase = useFileRestoreStore((state) => state.phase);
  const initialize = useWalletStore((state) => state.initialize);
  const isInitializing = useWalletStore((state) => state.isInitializing);
  const { isOnboarded, isCheckingOnboarding, checkOnboardingStatus } = useOnboardingStore();
  const [walletExists, setWalletExists] = useState<boolean | null>(null);

  // Cache manager in state instead of re-computing inside render body
  const [manager, setManager] = useState<any>(null);
  const settingsReady = useSettingsStore((state) => state.initialized);
  const [startupFinished, setStartupFinished] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  useAutomaticMintBackup(
    !storageError &&
      restorePhase === 'idle' &&
      !!manager &&
      !isInitializing &&
      isOnboarded &&
      walletExists === true,
  );

  const [loaded, error] = useFonts({
    AlloTextRegular: require('~/assets/fonts/AlloText-Regular.ttf'),
    AlloTextMedium: require('~/assets/fonts/AlloText-Medium.ttf'),
    AlloTextSemiBold: require('~/assets/fonts/AlloText-SemiBold.ttf'),
    AlloDisplayRegular: require('~/assets/fonts/AlloDisplay-Regular.ttf'),
    AlloDisplayMedium: require('~/assets/fonts/AlloDisplay-Medium.ttf'),
    AlloDisplaySemiBold: require('~/assets/fonts/AlloDisplay-SemiBold.ttf'),
  });

  // Check onboarding status and wallet existence on mount
  useEffect(() => {
    const checkStatus = async () => {
      setStorageError(null);
      try {
        await initService.resumePendingWalletDeletion();
        // Repair interrupted installation before opening a possibly damaged active database.
        assertEncryptedStorageAvailable();
        const installedRestore = await fileRestoreService.recoverOnStartup();
        if (!installedRestore && useFileRestoreStore.getState().phase === 'idle') getDb();
      } catch (error) {
        setStorageError(
          error instanceof DatabaseEncryptionUnavailableError
            ? 'Install the updated app build to open encrypted wallet storage.'
            : error instanceof WalletDeletionPendingError
              ? 'Wallet deletion could not finish. Retry to finish deleting this wallet.'
              : 'Wallet storage could not be opened. Your wallet has not been reset. Retry opening it.',
        );
        return;
      }
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
  }, [checkOnboardingStatus, startupAttempt]);

  // A wallet can be created while onboarding is open, after the startup check has completed.
  useEffect(() => {
    if (!isOnboarded) {
      setManager(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const exists = await initService.walletExists();
        if (!active) return;
        setWalletExists(exists);
        if (!exists) {
          setStorageError('Your saved wallet could not be found. Retry opening it.');
        }
      } catch {
        if (active) setStorageError('Your wallet could not be checked. Retry opening it.');
      }
    })();
    return () => {
      active = false;
    };
  }, [isOnboarded, startupAttempt]);

  // Initialize wallet only if onboarded and wallet exists
  useEffect(() => {
    if (!storageError && restorePhase === 'idle' && isOnboarded && walletExists) {
      let active = true;
      setStartupFinished(false);
      console.log('[RootLayout] ✅ Mnemonic found, initializing Coco...');
      void (async () => {
        try {
          await initialize();
          // Also permits retry after a transient local settings read failure.
          await useSettingsStore.getState().initialize();
        } catch {
          console.warn('[RootLayout] Wallet startup unavailable; retry opening wallet.');
        } finally {
          if (active) setStartupFinished(true);
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [isOnboarded, walletExists, initialize, startupAttempt, restorePhase, storageError]);

  // The local manager/settings are ready before network watchers finish.
  useEffect(() => {
    if (settingsReady && isOnboarded && walletExists) {
      try {
        setManager(initService.getManager());
      } catch (e) {
        setManager(null);
      }
    }
  }, [settingsReady, isInitializing, isOnboarded, walletExists, restorePhase]);

  // Hide splash when ready
  useEffect(() => {
    if ((loaded || error) && (restorePhase !== 'idle' || storageError)) {
      SplashScreen.hideAsync();
      return;
    }
    const isReady = (loaded || error) && !isCheckingOnboarding && walletExists !== null;
    const isAppReady =
      !isOnboarded || !walletExists || (!!manager && settingsReady) || startupFinished;

    if (isReady && isAppReady) {
      SplashScreen.hideAsync();
    }
  }, [
    loaded,
    error,
    isCheckingOnboarding,
    walletExists,
    isOnboarded,
    manager,
    settingsReady,
    startupFinished,
    restorePhase,
    storageError,
  ]);

  // Still loading fonts or checking onboarding
  if (!loaded && !error) {
    return null;
  }

  if (storageError)
    return (
      <Providers cocoManager={null}>
        <YStack flex={1} bg="$background" justify="center" p="$4" gap="$4">
          <Text color="$color" accessibilityRole="alert">
            {storageError}
          </Text>
          <AppButton onPress={() => setStartupAttempt((attempt) => attempt + 1)}>
            Retry opening wallet
          </AppButton>
        </YStack>
      </Providers>
    );

  if (restorePhase !== 'idle') {
    return (
      <Providers cocoManager={null}>
        <FileRestoreGate />
      </Providers>
    );
  }

  if (isCheckingOnboarding || walletExists === null) {
    return null;
  }

  // Completion owns the handoff even while wallet existence is being refreshed.
  if (!isOnboarded) {
    return (
      <Providers cocoManager={null}>
        <OnboardingScreen />
      </Providers>
    );
  }

  return (
    <Providers cocoManager={manager}>
      {manager && settingsReady ? (
        <>
          <RootLayoutNav />
          <NfcSheetHost walletReady={!isInitializing} />
          <NostrClaimSheet />
          <NostrPaymentReceived />
        </>
      ) : startupFinished ? (
        <YStack flex={1} bg="$background" justify="center" p="$4" gap="$4">
          <Text color="$color" accessibilityLiveRegion="polite">
            Your wallet could not be opened. Retry loading it.
          </Text>
          <AppButton onPress={() => setStartupAttempt((attempt) => attempt + 1)}>
            Retry opening wallet
          </AppButton>
        </YStack>
      ) : (
        <YStack flex={1} bg="$background" justify="center" items="center" gap="$3">
          <Spinner />
          <Text color="$gray10" accessibilityLiveRegion="polite">
            Opening wallet…
          </Text>
        </YStack>
      )}
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
