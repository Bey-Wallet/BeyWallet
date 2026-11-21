import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { OnboardingScreen } from '~/features/onboarding';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useWalletStore } from '~/state/walletStore';
import { initService } from '~/services/wallet';
import { walletFileService } from '~/services/platform/walletFileService';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import { connectMint } from '~/features/mints/connectMint';
import { networkService } from '~/services/platform/networkService';
import { nostrIdentityService } from '~/services/wallet/nostrIdentityService';
import {
  useRecoverySessionStore,
  acknowledgeRecovery,
  releaseRecoveryPause,
} from '~/state/recoverySessionStore';
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('~/services/wallet/recoveryDiscovery', () => ({
  importRecoveryCandidates: () => [{ mintUrl: 'https://synthetic.test', sources: ['Featured'] }],
}));
jest.mock('~/features/mints/connectMint', () => ({ connectMint: jest.fn() }));

jest.mock('~/features/onboarding/WelcomeStep', () => ({ WelcomeStep: 'Welcome' }));
jest.mock('~/features/onboarding/ImportSeedStep', () => ({ ImportSeedStep: 'Import' }));
jest.mock('~/features/onboarding/PermissionsStep', () => ({ PermissionsStep: 'Permissions' }));
jest.mock('~/features/onboarding/WalletCreationTask', () => ({ WalletCreationTask: 'Creation' }));
jest.mock('~/features/onboarding/ConsentStep', () => ({ ConsentStep: 'Consent' }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/shared/ui/Flex', () => ({ Flex: 'Flex' }));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: jest.fn(async () => false) },
}));
jest.mock('~/services/platform/walletFileService', () => ({
  walletFileService: { readWalletBackupFile: jest.fn() },
}));
const mockImportState = jest.fn();
const mockPrepareFileRestore = jest.fn();
jest.mock('~/services/wallet/fileRestoreService', () => ({
  fileRestoreService: { prepare: (...args: unknown[]) => mockPrepareFileRestore(...args) },
}));
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
jest.mock('~/services/wallet/nostrIdentityService', () => ({
  nostrIdentityService: { registerUsername: jest.fn() },
}));
jest.mock('~/services/wallet', () => ({
  initService: {
    walletExists: async () => false,
    restoreWallet: jest.fn(),
    createWallet: jest.fn(),
    reinitFast: jest.fn(),
  },
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
  jest.mocked(connectMint).mockReset().mockResolvedValue(undefined);
  jest.mocked(networkService.isOffline).mockResolvedValue(false);
  jest.mocked(initService.restoreWallet).mockImplementation(async (_mnemonic, options) => {
    // Match lifecycle cleanup: a normal replacement also clears onboarding's draft.
    if (!options?.preserveSetup) {
      useOnboardingStore.setState({ currentStep: 'welcome', generatedMnemonic: null });
    }
    return {} as any;
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
  useOnboardingStore.setState({
    isOnboarded: false,
    currentStep: 'welcome',
    generatedMnemonic: null,
    setStep: (currentStep: string) => useOnboardingStore.setState({ currentStep } as any),
    setGeneratedMnemonic: (generatedMnemonic: string) =>
      useOnboardingStore.setState({ generatedMnemonic }),
    completeOnboarding: jest.fn(),
  });
  useWalletStore.setState({
    mints: [],
    initialize: jest.fn(),
    recoverSelectedMints: jest.fn(),
    mintRestoreStatuses: [],
    isRestoring: false,
  });
});

it('connects only confirmed selections and completes after every mint connects', async () => {
  await importSeed();
  const complete = useOnboardingStore.getState().completeOnboarding;
  jest.mocked(connectMint).mockImplementation(async () => {
    expect(complete).not.toHaveBeenCalled();
  });
  await act(async () =>
    tree.root
      .findByType('Permissions' as any)
      .props.onComplete('', false, true, [
        'https://one.test',
        'https://two.test',
        'https://one.test/',
      ]),
  );
  expect(jest.mocked(connectMint).mock.calls).toEqual([
    ['https://one.test/'],
    ['https://two.test'],
  ]);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('retries a failed mint without recreating the wallet or reconnecting successful mints', async () => {
  await importSeed();
  jest.mocked(connectMint).mockImplementation(async (url) => {
    if (url === 'https://two.test') throw new Error('Synthetic connection failure');
    useWalletStore.setState({ mints: [{ mintUrl: url, trusted: true }] as any });
  });
  const finish = () =>
    tree.root
      .findByType('Permissions' as any)
      .props.onComplete('', false, true, ['https://one.test', 'https://two.test']);
  await act(async () => finish());
  expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
  expect(recoveryCoordinator.paused).toBe(false);
  jest.mocked(connectMint).mockResolvedValue(undefined);
  await act(async () => finish());
  expect(initService.restoreWallet).toHaveBeenCalledTimes(1);
  expect(jest.mocked(connectMint).mock.calls).toEqual([
    ['https://one.test'],
    ['https://two.test'],
    ['https://two.test'],
  ]);
  expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
  expect(recoveryCoordinator.paused).toBe(true);
});

it('opens a new wallet offline even with previously selected mints and username enabled', async () => {
  useOnboardingStore.setState({
    currentStep: 'permissions',
    generatedMnemonic: 'synthetic-seed-fixture',
  });
  jest.mocked(networkService.isOffline).mockResolvedValue(true);
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await act(async () =>
    tree.root
      .findByType('Permissions' as any)
      .props.onComplete('synthetic-user', false, false, ['https://offline.test']),
  );
  expect(initService.createWallet).toHaveBeenCalledTimes(1);
  expect(connectMint).not.toHaveBeenCalled();
  expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
});

it('can skip failed mint setup without recreating the saved wallet', async () => {
  await importSeed();
  jest.mocked(connectMint).mockRejectedValueOnce(new Error('Offline'));
  await act(async () =>
    tree.root
      .findByType('Permissions' as any)
      .props.onComplete('', false, true, ['https://offline.test']),
  );
  expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
  expect(tree.root.findByType('Permissions' as any).props.canSkipOptional).toBe(true);
  await act(async () =>
    tree.root.findByType('Permissions' as any).props.onComplete('', false, true, []),
  );
  expect(initService.restoreWallet).toHaveBeenCalledTimes(1);
  expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
});

it('bounds a stalled mint and reuses its pending connection on retry', async () => {
  await importSeed();
  jest.useFakeTimers();
  try {
    jest.mocked(connectMint).mockImplementation(() => new Promise(() => {}));
    const finish = () =>
      tree.root
        .findByType('Permissions' as any)
        .props.onComplete('', false, true, ['https://slow.test']);
    let pending!: Promise<void>;
    await act(async () => {
      pending = finish();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(12_000);
      await pending;
    });
    expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
    await act(async () => {
      pending = finish();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(12_000);
      await pending;
    });
    expect(connectMint).toHaveBeenCalledTimes(1);
    await act(async () =>
      tree.root.findByType('Permissions' as any).props.onComplete('', false, true, []),
    );
    expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('lets a stalled username time out and ignores late results after skipping', async () => {
  await importSeed();
  jest.useFakeTimers();
  try {
    let resolveRegistration!: (value: any) => void;
    jest.mocked(nostrIdentityService.registerUsername).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegistration = resolve;
        }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = tree.root
        .findByType('Permissions' as any)
        .props.onComplete('user', false, false, []);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
      await pending;
    });
    expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
    await act(async () => {
      pending = tree.root
        .findByType('Permissions' as any)
        .props.onComplete('user', false, false, []);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
      await pending;
    });
    expect(nostrIdentityService.registerUsername).toHaveBeenCalledTimes(1);
    await act(async () =>
      tree.root.findByType('Permissions' as any).props.onComplete('user', false, true, []),
    );
    await act(async () => resolveRegistration({ ok: true, nip05: 'user@bey.cash' }));
    expect(initService.restoreWallet).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
    expect(nostrIdentityService.registerUsername).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
afterEach(async () => {
  releaseRecoveryPause();
  useRecoverySessionStore.setState({ session: null });
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

async function openImport() {
  await act(async () => tree.root.findByType('Welcome' as any).props.onImportWallet());
  expect(useOnboardingStore.getState().currentStep).toBe('import');
  expect(tree.root.findAllByType('Consent' as any)).toHaveLength(0);
  expect(initService.restoreWallet).not.toHaveBeenCalled();
  expect(walletFileService.readWalletBackupFile).not.toHaveBeenCalled();
}

it.each([['onCreateWallet', 'creating']] as const)(
  'requires risk acknowledgment for %s and continues to %s',
  async (action, nextStep) => {
    await act(async () => {
      tree = create(<OnboardingScreen />);
    });
    await act(async () => tree.root.findByType('Welcome' as any).props[action]());
    expect(useOnboardingStore.getState().currentStep).toBe('consent');
    expect(initService.restoreWallet).not.toHaveBeenCalled();
    expect(walletFileService.readWalletBackupFile).not.toHaveBeenCalled();
    await act(async () => tree.root.findByType('Consent' as any).props.onBack());
    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
    await act(async () => tree.root.findByType('Welcome' as any).props[action]());
    await act(async () => tree.root.findByType('Consent' as any).props.onComplete());
    expect(useOnboardingStore.getState().currentStep).toBe(nextStep);
  },
);

async function importSeed() {
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await openImport();
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
    expect(tree.root.findByType('Permissions' as any).props.setupProgress).toEqual([
      { id: 'wallet', label: 'Restore wallet', status: 'running' },
      { id: 'security', label: 'Save security preferences', status: 'pending' },
      { id: 'data', label: 'Prepare recovery review', status: 'pending' },
      { id: 'finish', label: 'Open wallet', status: 'pending' },
    ]);
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

it('keeps seed setup intact through restore and retry, then saves the recovery handoff', async () => {
  await importSeed();
  const complete = jest
    .fn()
    .mockRejectedValueOnce(new Error('Synthetic setup storage failure'))
    .mockImplementation(async () => {
      expect(useRecoverySessionStore.getState().session?.needsReview).toBe(true);
      useOnboardingStore.setState({
        currentStep: 'complete',
        isOnboarded: true,
        generatedMnemonic: null,
      });
    });
  await act(async () => {
    useOnboardingStore.setState({ completeOnboarding: complete });
  });
  const finish = () => tree.root.findByType('Permissions' as any).props.onComplete('', false, true);
  await act(async () => finish());
  expect(useOnboardingStore.getState().currentStep).toBe('permissions');
  expect(useOnboardingStore.getState().generatedMnemonic).toBe('synthetic-seed-fixture');
  expect(tree.root.findAllByType('Welcome' as any)).toHaveLength(0);
  await act(async () => finish());
  expect(initService.restoreWallet).toHaveBeenCalledTimes(1);
  expect(initService.restoreWallet).toHaveBeenCalledWith('synthetic-seed-fixture', {
    quiet: false,
    preserveSetup: true,
  });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(useRecoverySessionStore.getState().session).toMatchObject({
    phase: 'review',
    needsReview: true,
  });
});

it('completes new-wallet setup without creating an import recovery session', async () => {
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await act(async () => tree.root.findByType('Welcome' as any).props.onCreateWallet());
  await act(async () => tree.root.findByType('Consent' as any).props.onComplete());
  await act(async () =>
    tree.root.findByType('Creation' as any).props.onComplete('synthetic-new-seed'),
  );
  await act(async () =>
    tree.root.findByType('Permissions' as any).props.onComplete('', false, true),
  );
  expect(initService.createWallet).toHaveBeenCalledWith('synthetic-new-seed');
  expect(initService.restoreWallet).not.toHaveBeenCalled();
  expect(useRecoverySessionStore.getState().session).toBeNull();
  expect(useOnboardingStore.getState().completeOnboarding).toHaveBeenCalledTimes(1);
});

it('restores file records and opens the wallet without an additional scan or setup step', async () => {
  const proofs = [
    { mintUrl: 'https://synthetic.test', secret: 'synthetic-proof-fixture', amount: 42 },
  ];
  jest.mocked(walletFileService.readWalletBackupFile).mockResolvedValueOnce({
    mnemonic: 'synthetic-seed-fixture',
    mints: [{ mintUrl: 'https://synthetic.test' }],
    proofs,
  } as any);
  jest.mocked(initService.restoreWallet).mockResolvedValueOnce({} as any);
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await openImport();
  expect(walletFileService.readWalletBackupFile).not.toHaveBeenCalled();
  mockPrepareFileRestore.mockImplementationOnce(async (data: any) => {
    expect(recoveryCoordinator.paused).toBe(true);
    expect(data.proofs).toBe(proofs);
    expect(useRecoverySessionStore.getState().session).toBeNull();
  });
  await act(async () =>
    tree.root.findByType('Import' as any).props.onImportFromFile('file:///backup.json'),
  );
  expect(mockPrepareFileRestore).toHaveBeenCalledTimes(1);
  expect(mockImportState).not.toHaveBeenCalled();
  expect(initService.reinitFast).not.toHaveBeenCalled();
  expect(useRecoverySessionStore.getState().session).toBeNull();
  expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
  expect(recoveryCoordinator.paused).toBe(false);
  expect(tree.root.findAllByType('Permissions' as any)).toHaveLength(0);
  expect(useWalletStore.getState().recoverSelectedMints).not.toHaveBeenCalled();
  acknowledgeRecovery();
  expect(proofs).toHaveLength(1);
  expect(proofs[0].amount).toBe(42);
});

it('does not initialize or complete onboarding when the selected backup is invalid', async () => {
  jest
    .mocked(walletFileService.readWalletBackupFile)
    .mockRejectedValueOnce(new Error('Invalid backup'));
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await openImport();
  await act(async () =>
    tree.root.findByType('Import' as any).props.onImportFromFile('file:///invalid.json'),
  );
  expect(initService.restoreWallet).not.toHaveBeenCalled();
  expect(mockImportState).not.toHaveBeenCalled();
  expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
  expect(recoveryCoordinator.paused).toBe(false);
});

it('keeps onboarding open and releases its pause if restoring file records fails', async () => {
  jest
    .mocked(walletFileService.readWalletBackupFile)
    .mockResolvedValueOnce({ mnemonic: 'synthetic-seed-fixture', mints: [] } as any);
  mockImportState.mockRejectedValueOnce(new Error('Synthetic restore failure'));
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  await openImport();
  await act(async () =>
    tree.root.findByType('Import' as any).props.onImportFromFile('file:///backup.json'),
  );
  expect(useOnboardingStore.getState().completeOnboarding).not.toHaveBeenCalled();
  expect(recoveryCoordinator.paused).toBe(false);
  expect(useWalletStore.getState().recoverSelectedMints).not.toHaveBeenCalled();
});
