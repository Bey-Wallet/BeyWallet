import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const ONBOARDING_KEY = 'bey_wallet_onboarded'

type OnboardingStep = 'welcome' | 'creating' | 'seed' | 'biometric' | 'notifications' | 'nostr' | 'mintpicker' | 'import' | 'restoring' | 'complete'

interface OnboardingState {
    isOnboarded: boolean
    isCheckingOnboarding: boolean
    currentStep: OnboardingStep
    generatedMnemonic: string | null

    // Actions
    checkOnboardingStatus: () => Promise<void>
    setStep: (step: OnboardingStep) => void
    setGeneratedMnemonic: (mnemonic: string) => void
    completeOnboarding: () => Promise<void>
    resetOnboarding: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
    isOnboarded: false,
    isCheckingOnboarding: true,
    currentStep: 'welcome',
    generatedMnemonic: null,

    checkOnboardingStatus: async () => {
        set({ isCheckingOnboarding: true })
        try {
            const status = await SecureStore.getItemAsync(ONBOARDING_KEY)
            set({
                isOnboarded: status === 'true',
                isCheckingOnboarding: false
            })
            console.log(`[OnboardingStore] Checked status: ${status === 'true'}`)
        } catch (err) {
            console.error('[OnboardingStore] Error checking status:', err)
            set({ isOnboarded: false, isCheckingOnboarding: false })
        }
    },

    setStep: (step) => {
        set({ currentStep: step })
    },

    setGeneratedMnemonic: (mnemonic) => {
        set({ generatedMnemonic: mnemonic })
    },

    completeOnboarding: async () => {
        try {
            await SecureStore.setItemAsync(ONBOARDING_KEY, 'true')
            set({
                isOnboarded: true,
                currentStep: 'complete',
                generatedMnemonic: null // Clear mnemonic from memory
            })
        } catch (err) {
            console.error('[OnboardingStore] Error completing onboarding:', err)
        }
    },

    resetOnboarding: async () => {
        try {
            await SecureStore.deleteItemAsync(ONBOARDING_KEY)
            set({
                isOnboarded: false,
                currentStep: 'welcome',
                generatedMnemonic: null
            })
        } catch (err) {
            console.error('[OnboardingStore] Error resetting onboarding:', err)
        }
    }
}))
