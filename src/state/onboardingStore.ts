import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { appLogger } from '~/shared/utils/appLogger';

const ONBOARDING_KEY = 'bey_wallet_onboarded';

type OnboardingStep = 'welcome' | 'creating' | 'import' | 'complete' | 'consent' | 'permissions';

interface OnboardingState {
  isOnboarded: boolean;
  isCheckingOnboarding: boolean;
  currentStep: OnboardingStep;
  generatedMnemonic: string | null;

  // Actions
  checkOnboardingStatus: () => Promise<boolean>;
  setStep: (step: OnboardingStep) => void;
  setGeneratedMnemonic: (mnemonic: string) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  isOnboarded: false,
  isCheckingOnboarding: true,
  currentStep: 'welcome',
  generatedMnemonic: null,

  checkOnboardingStatus: async () => {
    set({ isCheckingOnboarding: true });
    try {
      const status = await SecureStore.getItemAsync(ONBOARDING_KEY);
      set({
        isOnboarded: status === 'true',
        isCheckingOnboarding: false,
      });

      return status === 'true';
    } catch (err) {
      appLogger.error('[OnboardingStore] Error checking status:', err, 'wallet_start');
      set({ isOnboarded: false, isCheckingOnboarding: false });
      return false;
    }
  },

  setStep: (step) => {
    set({ currentStep: step });
  },

  setGeneratedMnemonic: (mnemonic) => {
    set({ generatedMnemonic: mnemonic });
  },

  completeOnboarding: async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      set({
        isOnboarded: true,
        currentStep: 'complete',
        generatedMnemonic: null, // Clear mnemonic from memory
      });
    } catch {
      appLogger.error(
        '[OnboardingStore] Could not save onboarding completion.',
        undefined,
        'wallet_start',
      );
      throw new Error('Could not save wallet setup. Please retry.');
    }
  },

  resetOnboarding: async () => {
    try {
      await SecureStore.deleteItemAsync(ONBOARDING_KEY);
      set({
        isOnboarded: false,
        currentStep: 'welcome',
        generatedMnemonic: null,
      });
    } catch (err) {
      appLogger.error('[OnboardingStore] Error resetting onboarding:', err, 'wallet_start');
    }
  },
}));
