import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SplashScreen } from 'expo-router';
import { RootLayout } from '~/shared/layout/RootLayout';
import { useSettingsStore } from '~/state/settingsStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { initService } from '~/services/wallet';

const mockInitialize = jest.fn();
jest.mock('~/services/wallet/fileRestoreService', () => ({
  fileRestoreService: { recoverOnStartup: async () => {} },
}));
jest.mock('~/state/fileRestoreStore', () => ({
  useFileRestoreStore: Object.assign((select: any) => select({ phase: 'idle' }), {
    getState: () => ({ phase: 'idle' }),
  }),
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ getDb: jest.fn() }));
jest.mock('~/storage/sqlite/encryptedDatabase', () => ({
  assertEncryptedStorageAvailable: jest.fn(),
  DatabaseEncryptionUnavailableError: class extends Error {},
  WalletDeletionPendingError: class extends Error {},
}));
jest.mock('~/features/settings/FileRestoreGate', () => ({ FileRestoreGate: () => null }));
let mockManager: object | null = null;
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
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
    resumePendingWalletDeletion: jest.fn(async () => {}),
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
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: require('zustand').create(() => ({
    isOnboarded: true,
    isCheckingOnboarding: false,
    checkOnboardingStatus: jest.fn(async () => true),
  })),
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockManager = null;
  jest.mocked(initService.walletExists).mockResolvedValue(true);
  useOnboardingStore.setState({
    isOnboarded: true,
    isCheckingOnboarding: false,
    currentStep: 'welcome',
  });
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
  expect(JSON.stringify(tree.toJSON())).not.toContain('Opening wallet');
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

it('does not return to Welcome while opening a newly completed wallet', async () => {
  useOnboardingStore.setState({ isOnboarded: false });
  jest.mocked(initService.walletExists).mockResolvedValue(false);
  mockInitialize.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Welcome');

  let finishCheck!: (exists: boolean) => void;
  jest.mocked(initService.walletExists).mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finishCheck = resolve;
      }),
  );
  await act(async () => {
    mockManager = {};
    useSettingsStore.setState({ initialized: true });
    useOnboardingStore.setState({ isOnboarded: true, currentStep: 'complete' });
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Welcome');
  expect(JSON.stringify(tree.toJSON())).toContain('Opening wallet');
  await act(async () => finishCheck(true));
  expect(JSON.stringify(tree.toJSON())).toContain('Home');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Welcome');
});

it('offers a retry when the completed wallet cannot be checked instead of showing Welcome', async () => {
  useOnboardingStore.setState({ isOnboarded: false });
  jest.mocked(initService.walletExists).mockResolvedValue(false);
  mockInitialize.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<RootLayout />);
  });
  jest.mocked(initService.walletExists).mockRejectedValue(new Error('Synthetic storage error'));
  await act(async () => {
    useOnboardingStore.setState({ isOnboarded: true });
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Retry opening wallet');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Welcome');
  jest.mocked(initService.walletExists).mockResolvedValue(true);
  mockManager = {};
  await act(async () => {
    useSettingsStore.setState({ initialized: true });
    tree.root.findByType('AppButton' as any).props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Home');
});
