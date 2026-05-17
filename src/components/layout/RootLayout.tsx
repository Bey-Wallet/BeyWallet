import { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'
import { SplashScreen } from 'expo-router'
import { Provider } from '../Provider'
import { RootLayoutNav } from './RootLayoutNav'
import { initService } from '../../services/core'
import { useWalletStore } from '../../store/walletStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnboardingScreen } from '../../screens/OnboardingScreen'
import { NostrPaymentReceived } from '../NostrPaymentReceived'

const queryClient = new QueryClient()

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export function RootLayout() {
    const initialize = useWalletStore(state => state.initialize)
    const isInitializing = useWalletStore(state => state.isInitializing)
    const { isOnboarded, isCheckingOnboarding, checkOnboardingStatus } = useOnboardingStore()
    const [walletExists, setWalletExists] = useState<boolean | null>(null)

    // Cache manager in state instead of re-computing inside render body
    const [manager, setManager] = useState<any>(null);

    const [loaded, error] = useFonts({
        BaselGroteskBook: require('../../assets/fonts/Inter-Tight-Medium.otf'),
        BaselGroteskMedium: require('../../assets/fonts/Inter-Tight-SemiBold.otf'),
    })

    // Check onboarding status and wallet existence on mount
    useEffect(() => {
        const checkStatus = async () => {
            await checkOnboardingStatus()
            const exists = await initService.walletExists()
            setWalletExists(exists)
            console.log(`[RootLayout] Startup check — onboarded: ${isOnboarded}, walletExists: ${exists}`)
            if (exists && !isOnboarded) {
                console.log('[RootLayout] ⚠️ Wallet found but marked as not onboarded. User may see welcome screen.');
            }
        }
        checkStatus()
    }, [isOnboarded]) // Re-check when onboarding status changes

    // Initialize wallet only if onboarded and wallet exists
    useEffect(() => {
        if (isOnboarded && walletExists) {
            console.log('[RootLayout] ✅ Mnemonic found, initializing Coco...')
            initialize()
        }
    }, [isOnboarded, walletExists, initialize])

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
        const isReady = (loaded || error) && !isCheckingOnboarding && walletExists !== null
        const isAppReady = !isOnboarded || (!isInitializing && isOnboarded)

        if (isReady && isAppReady) {
            SplashScreen.hideAsync()
        }
    }, [loaded, error, isCheckingOnboarding, walletExists, isOnboarded, isInitializing])

    // Still loading fonts or checking onboarding
    if (!loaded && !error) {
        return null
    }

    if (isCheckingOnboarding || walletExists === null) {
        return null
    }

    // Show onboarding if not completed or no wallet exists
    if (!isOnboarded || !walletExists) {
        return (
            <Providers cocoManager={null}>
                <OnboardingScreen />
            </Providers>
        )
    }

    return (
        <Providers cocoManager={manager}>
            <RootLayoutNav />
            <NostrPaymentReceived />
        </Providers>
    )
}

const Providers = ({ children, cocoManager }: { children: React.ReactNode; cocoManager: any }) => {
    return (
        <QueryClientProvider client={queryClient}>
            <Provider cocoManager={cocoManager}>
                {children}
            </Provider>
        </QueryClientProvider>
    )
}
