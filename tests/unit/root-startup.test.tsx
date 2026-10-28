import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SplashScreen } from 'expo-router';
import { RootLayout } from '~/shared/layout/RootLayout';
import { useSettingsStore } from '~/state/settingsStore';

const mockInitialize = jest.fn();
let mockManager: object | null = null;
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Provider', () => ({ Provider: ({ children }: any) => children }));
jest.mock('~/shared/layout/RootLayoutNav', () => ({ RootLayoutNav: () => 'Home' }));
jest.mock('~/features/onboarding', () => ({ OnboardingScreen: () => 'Welcome' }));
jest.mock('~/features/nostr/components/NostrPaymentReceived', () => ({
  NostrPaymentReceived: () => null,
}));
jest.mock('~/features/nostr/components/NostrClaimSheet', () => ({ NostrClaimSheet: () => null }));
jest.mock('~/features/nfc/NfcSheetHost', () => ({ NfcSheetHost: 'NfcSheetHost' }));
jest.mock('~/shared/hooks/useAutomaticMintBackup', () => ({ useAutomaticMintBackup: jest.fn() }));
jest.mock('~/shared/utils/bitcoinPriceQueryCache', () => ({ hydrateBitcoinPriceCache: jest.fn() }));
jest.mock('~/services/wallet', () => ({
  initService: {
    walletExists: jest.fn(async () => true),
    getManager: () => {
      if (!mockManager) throw new Error('Not ready');
      return mockManager;
    },
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ initialize: mockInitialize, isInitializing: true }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({
    initialized: false,
    initialize: jest.fn(async () => {}),
  })),
}));
jest.mock('~/state/onboardingStore', () => {
  const state = {
    isOnboarded: true,
    isCheckingOnboarding: false,
    checkOnboardingStatus: jest.fn(async () => true),
  };
  return { useOnboardingStore: () => state };
});

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockManager = null;
  useSettingsStore.setState({ initialized: false });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('opens Home after local privacy settings, before network initialization completes', async () => {
  let finish!: () => void;
  mockInitialize.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Home');
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  await act(async () => {
    mockManager = {};
    useSettingsStore.setState({ initialized: true });
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Home');
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
  expect(tree.root.findByType('NfcSheetHost' as any).props.walletReady).toBe(false);
  await act(async () => finish());
});

it('provides a safe retry if local startup fails without showing Home or a permanent spinner', async () => {
  mockInitialize.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Retry opening wallet');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Home');
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
  await act(async () => tree.root.findByType('AppButton' as any).props.onPress());
  expect(mockInitialize).toHaveBeenCalledTimes(2);
});
