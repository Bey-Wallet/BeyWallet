import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { OnboardingScreen } from '~/features/onboarding';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useWalletStore } from '~/state/walletStore';
import { initService } from '~/services/wallet';
import { walletFileService } from '~/services/platform/walletFileService';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import {
  useRecoverySessionStore,
  acknowledgeRecovery,
  releaseRecoveryPause,
} from '~/state/recoverySessionStore';
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('~/services/wallet/recoveryDiscovery', () => ({
  importRecoveryCandidates: () => [{ mintUrl: 'https://synthetic.test', sources: ['Default'] }],
}));

jest.mock('~/features/onboarding/WelcomeStep', () => ({ WelcomeStep: 'Welcome' }));
jest.mock('~/features/onboarding/ImportSeedStep', () => ({ ImportSeedStep: 'Import' }));
jest.mock('~/features/onboarding/PermissionsStep', () => ({ PermissionsStep: 'Permissions' }));
jest.mock('~/features/onboarding/WalletCreationTask', () => ({ WalletCreationTask: () => null }));
jest.mock('~/features/onboarding/ConsentStep', () => ({ ConsentStep: () => null }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/shared/ui/Flex', () => ({ Flex: 'Flex' }));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: async () => false },
}));
jest.mock('~/services/platform/walletFileService', () => ({
  walletFileService: { importWalletFromFile: jest.fn() },
}));
const mockImportState = jest.fn();
jest.mock('~/services/wallet/backupService', () => ({
  backupService: { importState: (...args: any[]) => mockImportState(...args) },
}));
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
  initService: { walletExists: async () => false, restoreWallet: jest.fn(), reinitFast: jest.fn() },
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
    recoverSelectedMints: jest.fn(),
    mintRestoreStatuses: [],
    isRestoring: false,
  });
});
afterEach(async () => {
  releaseRecoveryPause();
  useRecoverySessionStore.setState({ session: null });
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

it('pauses before import initialization and hands off to review without scanning', async () => {
  let finishInit!: () => void;
  const initialization = new Promise<void>((resolve) => {
    finishInit = resolve;
  });
  jest.mocked(initService.restoreWallet).mockImplementation(async () => {
    expect(recoveryCoordinator.paused).toBe(true);
    await initialization;
    return {} as any;
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
    expect(useWalletStore.getState().recoverSelectedMints).not.toHaveBeenCalled();
    expect(useRecoverySessionStore.getState().session).toMatchObject({
      phase: 'review',
      needsReview: true,
      selected: ['https://synthetic.test'],
    });
    expect(recoveryCoordinator.paused).toBe(true);
  } finally {
    finishInit();
    await setup;
  }
  acknowledgeRecovery();
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
  expect(useWalletStore.getState().recoverSelectedMints).not.toHaveBeenCalled();
});

it('imports file proofs before handing off to review and never starts a scan', async () => {
  const proofs = [
    { mintUrl: 'https://synthetic.test', secret: 'synthetic-proof-fixture', amount: 42 },
  ];
  jest.mocked(walletFileService.importWalletFromFile).mockResolvedValueOnce({
    mnemonic: 'synthetic-seed-fixture',
    mints: [{ mintUrl: 'https://synthetic.test' }],
    proofs,
  } as any);
  jest.mocked(initService.restoreWallet).mockResolvedValueOnce({} as any);
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await act(async () => tree.root.findByType('Welcome' as any).props.onImportFromFile());
  mockImportState.mockImplementationOnce(async (data: any) => {
    expect(recoveryCoordinator.paused).toBe(true);
    expect(data.proofs).toBe(proofs);
    expect(useRecoverySessionStore.getState().session).toBeNull();
  });
  await act(async () =>
    tree.root.findByType('Permissions' as any).props.onComplete('', false, true),
  );
  expect(mockImportState).toHaveBeenCalledTimes(1);
  expect(initService.reinitFast).toHaveBeenCalledTimes(1);
  expect(useRecoverySessionStore.getState().session?.phase).toBe('review');
  expect(useWalletStore.getState().recoverSelectedMints).not.toHaveBeenCalled();
  acknowledgeRecovery();
  expect(proofs).toHaveLength(1);
  expect(proofs[0].amount).toBe(42);
});
