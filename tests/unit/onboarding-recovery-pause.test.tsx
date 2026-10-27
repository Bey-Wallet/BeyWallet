import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { OnboardingScreen } from '~/features/onboarding';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useWalletStore } from '~/state/walletStore';
import { initService } from '~/services/wallet';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';

jest.mock('~/features/onboarding/WelcomeStep', () => ({ WelcomeStep: 'Welcome' }));
jest.mock('~/features/onboarding/ImportSeedStep', () => ({ ImportSeedStep: 'Import' }));
jest.mock('~/features/onboarding/PermissionsStep', () => ({ PermissionsStep: 'Permissions' }));
jest.mock('~/features/onboarding/WalletCreationTask', () => ({ WalletCreationTask: () => null }));
jest.mock('~/features/onboarding/SeedStep', () => ({ SeedStep: () => null }));
jest.mock('~/features/onboarding/BiometricStep', () => ({ BiometricStep: () => null }));
jest.mock('~/features/onboarding/NotificationStep', () => ({ NotificationStep: () => null }));
jest.mock('~/features/onboarding/NostrStep', () => ({ NostrStep: () => null }));
jest.mock('~/features/onboarding/ConsentStep', () => ({ ConsentStep: () => null }));
jest.mock('~/features/onboarding/RestoreProgressStep', () => ({ RestoreProgressStep: () => null }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/shared/ui/Flex', () => ({ Flex: 'Flex' }));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: async () => false },
}));
jest.mock('~/services/platform/walletFileService', () => ({ walletFileService: {} }));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getNostrKeys: async () => ({
      pubkey: 'a'.repeat(64),
      privkey: 'b'.repeat(64),
      npub: 'synthetic',
    }),
  },
}));
jest.mock('~/shared/utils/username', () => ({
  generateDeterministicUsername: () => 'synthetic-user',
}));
jest.mock('~/services/wallet/nostrIdentityService', () => ({ nostrIdentityService: {} }));
jest.mock('~/services/wallet', () => ({
  initService: { walletExists: async () => false, restoreWallet: jest.fn() },
  mintManager: { addMint: jest.fn() },
  nostrService: { fetchMintsFromNostr: async () => [] },
}));
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: require('zustand').create(() => ({})),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setBiometricEnabled: jest.fn(),
      initialize: jest.fn(),
      setDefaultMintUrl: jest.fn(),
      setNip05: jest.fn(),
    }),
  },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: { getState: () => ({ setAuthenticated: jest.fn() }) },
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
  useOnboardingStore.setState({
    currentStep: 'welcome',
    generatedMnemonic: null,
    setStep: (currentStep: string) => useOnboardingStore.setState({ currentStep } as any),
    setGeneratedMnemonic: (generatedMnemonic: string) =>
      useOnboardingStore.setState({ generatedMnemonic }),
    completeOnboarding: jest.fn(),
  });
  useWalletStore.setState({
    initialize: jest.fn(),
    restoreAllMints: jest.fn(),
    mintRestoreStatuses: [],
    isRestoring: false,
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

async function importSeed() {
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await act(async () => tree.root.findByType('Welcome' as any).props.onImportWallet());
  await act(async () =>
    tree.root.findByType('Import' as any).props.onImport('synthetic-seed-fixture'),
  );
}

it('pauses before seed-import initialization and hands the pause over to the full scan queue', async () => {
  let finishInit!: () => void;
  const initialization = new Promise<void>((resolve) => {
    finishInit = resolve;
  });
  jest.mocked(initService.restoreWallet).mockImplementation(async () => {
    expect(recoveryCoordinator.paused).toBe(true);
    await initialization;
    return {} as any;
  });
  let finishScan!: () => void;
  const scanning = new Promise<void>((resolve) => {
    finishScan = resolve;
  });
  let job: Promise<void> | undefined;
  useWalletStore.setState({
    restoreAllMints: () => {
      job = recoveryCoordinator.enqueue('https://synthetic.test', () => scanning);
      return job;
    },
  });
  await importSeed();
  let setup!: Promise<void>;
  try {
    await act(async () => {
      setup = tree.root.findByType('Permissions' as any).props.onComplete('', false, true);
    });
    expect(initService.restoreWallet).toHaveBeenCalledTimes(1);
    expect(recoveryCoordinator.paused).toBe(true);
    await act(async () => {
      finishInit();
      await setup;
    });
    expect(job).toBeDefined();
    expect(recoveryCoordinator.paused).toBe(true);
  } finally {
    finishInit();
    finishScan();
    await setup;
    await job;
  }
  expect(recoveryCoordinator.paused).toBe(false);
});

it('releases the import pause if wallet initialization fails', async () => {
  jest
    .mocked(initService.restoreWallet)
    .mockRejectedValueOnce(new Error('Synthetic mint unavailable'));
  await importSeed();
  await act(async () =>
    tree.root.findByType('Permissions' as any).props.onComplete('', false, true),
  );
  expect(recoveryCoordinator.paused).toBe(false);
  expect(useWalletStore.getState().restoreAllMints).not.toHaveBeenCalled();
});
