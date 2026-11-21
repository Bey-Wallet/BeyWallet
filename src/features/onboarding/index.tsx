import { interactionCopy } from '~/services/feedback/interactionCopy';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import {
  useRecoverySessionStore,
  holdRecoveryPause,
  releaseRecoveryPause,
} from '~/state/recoverySessionStore';
import { importRecoveryCandidates } from '~/services/wallet/recoveryDiscovery';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import React, { useRef, useState } from 'react';
import { WelcomeStep } from '~/features/onboarding/WelcomeStep';
import { WalletCreationTask } from '~/features/onboarding/WalletCreationTask';
import { networkService } from '~/services/platform/networkService';
import { ImportSeedStep } from '~/features/onboarding/ImportSeedStep';
import { ConsentStep } from '~/features/onboarding/ConsentStep';
import { PermissionsStep, type SetupProgressStep } from '~/features/onboarding/PermissionsStep';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useSettingsStore } from '~/state/settingsStore';
import { seedService } from '~/services/platform/seedService';
import { initService, nostrService } from '~/services/wallet';
import { connectMint } from '~/features/mints/connectMint';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { useWalletStore } from '~/state/walletStore';
import { useAuthStore } from '~/state/authStore';
import { walletFileService } from '~/services/platform/walletFileService';
import { fileRestoreService } from '~/services/wallet/fileRestoreService';
import { withTimeout } from '~/shared/utils/withTimeout';
import { Text, YStack } from 'tamagui';
import { generateDeterministicUsername } from '~/shared/utils/username';
import { nostrIdentityService } from '~/services/wallet/nostrIdentityService';
import { Flex } from '~/shared/ui/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appLogger } from '~/shared/utils/appLogger';

export function OnboardingScreen() {
  const { currentStep, setStep, setGeneratedMnemonic, generatedMnemonic, completeOnboarding } =
    useOnboardingStore();
  const initialize = useWalletStore((state) => state.initialize);

  const [isImporting, setIsImporting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishLock = useRef(false);
  const setupPrepared = useRef(false);
  const usernamePrepared = useRef(false);
  const pendingUsername = useRef<ReturnType<typeof nostrIdentityService.registerUsername> | null>(
    null,
  );
  const [canSkipOptional, setCanSkipOptional] = useState(false);
  const pendingMintConnections = useRef(new Map<string, Promise<void>>());
  const [setupError, setSetupError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState('');
  const [tempUsername, setTempUsername] = useState('anon');
  const [tempNpub, setTempNpub] = useState('');
  const [isImportingFlow, setIsImportingFlow] = useState(false);
  const [tempBackupState, setTempBackupState] = useState<any>(null);
  const [finishingStatus, setFinishingStatus] = useState('Setting up wallet…');
  const [setupProgress, setSetupProgress] = useState<SetupProgressStep[]>([]);
  const startSetupStep = (id: string) => {
    setSetupProgress((steps) => {
      const activeIndex = steps.findIndex((step) => step.id === id);
      return steps.map((step, index) => ({
        ...step,
        status: index < activeIndex ? 'done' : index === activeIndex ? 'running' : 'pending',
      }));
    });
  };
  // Extra mints from a backup file
  const [extraRestoreMints, setExtraRestoreMints] = useState<string[]>([]);
  const [nostrRestoreMints, setNostrRestoreMints] = useState<string[]>([]);
  const [discoveryMessage, setDiscoveryMessage] = useState<string>();
  const [hasSavedWallet, setHasSavedWallet] = useState(false);
  const [savedWalletAction, setSavedWalletAction] = useState<'open' | 'delete' | null>(null);
  const toast = useAppToast();
  const busy = currentStep === 'creating' || isImporting || isFinishing;
  usePendingOperationToast({
    active:
      currentStep === 'creating' ||
      (isImporting && currentStep !== 'import') ||
      (isFinishing && currentStep !== 'permissions' && currentStep !== 'welcome'),
    title:
      currentStep === 'creating'
        ? 'Creating wallet…'
        : isImporting
          ? importStatus || 'Importing wallet…'
          : finishingStatus,
  });

  const registerOnboardingUsername = async (
    username: string,
    pubkeyHex: string,
    privkeyHex: string,
    offline: boolean,
    skipUsername: boolean,
  ) => {
    if (offline || skipUsername) {
      await useSettingsStore.getState().setNip05(null);
      return;
    }

    setFinishingStatus('Registering username…');
    if (!pendingUsername.current) {
      const registration = nostrIdentityService.registerUsername(username, pubkeyHex, privkeyHex);
      pendingUsername.current = registration;
      const clear = () => {
        pendingUsername.current = null;
      };
      void registration.then(clear, clear);
    }
    const result = await withTimeout(pendingUsername.current, 15_000);
    if (result.ok && result.nip05) {
      await useSettingsStore.getState().setNip05(result.nip05);
      return;
    }

    // Never persist an identity until the public NIP-05 mapping is verified.
    await useSettingsStore.getState().setNip05(null);
    throw new Error(result.error || 'The public NIP-05 record could not be verified.');
  };

  // Check on mount if a wallet exists but onboarding was not completed
  React.useEffect(() => {
    const checkWallet = async () => {
      const exists = await initService.walletExists();
      setHasSavedWallet(exists);
    };
    checkWallet();
  }, []);

  const handleResumeRestore = async () => {
    if (busy) return;
    setSavedWalletAction('open');
    setIsFinishing(true);
    const resumeRecoveryWork = isImportingFlow ? recoveryCoordinator.pause() : undefined;
    try {
      await initService.init();
      await useSettingsStore.getState().initialize(true);
      await initialize();
      await completeOnboarding();
      useAuthStore.getState().setAuthenticated(true);
    } catch (err) {
      appLogger.error('[Onboarding] Failed to resume wallet:', err, 'wallet_start');
      setSetupError('Could not open this wallet. Retry opening it.');
    } finally {
      resumeRecoveryWork?.();
      setIsFinishing(false);
      setSavedWalletAction(null);
    }
  };

  const handleDeleteSavedWallet = async () => {
    if (busy) return;
    setSavedWalletAction('delete');
    setIsFinishing(true);
    try {
      await initService.destroyWallet();
      setHasSavedWallet(false);
      setStep('welcome');
      toast.showFeedback(interactionCopy.walletDeleted);
    } catch (err) {
      appLogger.error('[Onboarding] Failed to delete wallet:', err, 'wallet_start');
      setSetupError('Wallet deletion did not finish. Restart Bey and review the wallet.');
    } finally {
      setIsFinishing(false);
      setSavedWalletAction(null);
    }
  };

  // ── Navigation ──────────────────────────────────────────────

  const handleCreateWallet = () => {
    if (busy) return;
    setIsImportingFlow(false);
    setStep('consent');
  };
  const handleImportWallet = () => {
    if (busy) return;
    setIsImportingFlow(true);
    setStep('import');
  };

  const handleConsentComplete = () => {
    if (isImportingFlow) {
      setStep('import');
    } else {
      setStep('creating');
    }
  };

  const handleCreatingComplete = async (mnemonic: string) => {
    setGeneratedMnemonic(mnemonic);
    try {
      const keys = await seedService.getNostrKeys(mnemonic);
      setTempNpub(keys.npub);
      const genName = generateDeterministicUsername(keys.pubkey);
      setTempUsername(genName);
    } catch (e) {
      setTempUsername('anon');
    }
    setStep('permissions');
  };

  const handlePermissionsComplete = async (
    username: string,
    isBiometricEnabled: boolean,
    skipUsername: boolean = false,
    mintUrls: string[] = [],
  ) => {
    if (finishLock.current) return;
    if (!generatedMnemonic) {
      setStep('welcome');
      return;
    }

    finishLock.current = true;
    const resumeRecoveryWork = isImportingFlow ? recoveryCoordinator.pause() : undefined;
    setIsFinishing(true);
    setSetupError(null);
    const selectedUrls = [...new Map(mintUrls.map((url) => [mintUrlKey(url), url])).values()];
    setSetupProgress([
      {
        id: 'wallet',
        label: isImportingFlow ? 'Restore wallet' : 'Create wallet',
        status: 'running',
      },
      { id: 'security', label: 'Save security preferences', status: 'pending' },
      {
        id: 'data',
        label: isImportingFlow ? 'Prepare recovery review' : 'Load wallet',
        status: 'pending',
      },
      ...(!skipUsername
        ? [{ id: 'profile', label: 'Set up username', status: 'pending' as const }]
        : []),
      ...selectedUrls.map((url, index) => ({
        id: `mint-${index}`,
        label: `Connect ${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`,
        status: 'pending' as const,
      })),
      { id: 'finish', label: 'Open wallet', status: 'pending' },
    ]);
    try {
      // Yield to the progress view before starting key/storage work; no timed delay.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const keys = await seedService.getNostrKeys(generatedMnemonic);
      const pubkeyHex = keys.pubkey;
      const privkeyHex = keys.privkey;
      const offline = await networkService.isOffline();
      if (offline) {
        setSetupProgress((steps) =>
          steps.filter((step) => step.id !== 'profile' && !step.id.startsWith('mint-')),
        );
      }

      if (!setupPrepared.current) {
        if (isImportingFlow) {
          const candidates = importRecoveryCandidates(extraRestoreMints, nostrRestoreMints);
          setFinishingStatus('Initializing wallet…');
          await initService.restoreWallet(generatedMnemonic, {
            quiet: !!tempBackupState,
            preserveSetup: true,
          });

          startSetupStep('security');
          await useSettingsStore.getState().setBiometricEnabled(isBiometricEnabled);
          await useSettingsStore.getState().initialize(true);

          startSetupStep('data');
          if (tempBackupState) {
            setFinishingStatus('Restoring balance and history…');
            const { backupService } = require('~/services/wallet/backupService');
            await backupService.importState(tempBackupState);

            await initService.reinitFast();
          }

          await initialize();

          holdRecoveryPause();
          useRecoverySessionStore.setState({
            session: {
              walletId: pubkeyHex,
              origin: 'import',
              candidates,
              selected: candidates.map((c) => c.mintUrl),
              phase: 'review',
              results: [],
              needsReview: true,
              discoveryMessage,
            },
          });
        } else {
          setFinishingStatus('Creating secure keypair…');
          await initService.createWallet(generatedMnemonic);
          startSetupStep('security');
          await useSettingsStore.getState().setBiometricEnabled(isBiometricEnabled);
          await useSettingsStore.getState().initialize(true);
          startSetupStep('data');
          await initialize();
        }
        setupPrepared.current = true;
      }
      setCanSkipOptional(true);
      if (!usernamePrepared.current) {
        if (!skipUsername && !offline) startSetupStep('profile');
        await registerOnboardingUsername(username, pubkeyHex, privkeyHex, offline, skipUsername);
        usernamePrepared.current = true;
      }

      // Keep successful connections on retry; never recreate a prepared wallet.
      for (const [index, url] of selectedUrls.entries()) {
        if (offline) break;
        startSetupStep(`mint-${index}`);
        setFinishingStatus(`Connecting mint ${index + 1} of ${selectedUrls.length}…`);
        const connected = useWalletStore
          .getState()
          .mints.some((mint) => mintUrlKey(mint.mintUrl) === mintUrlKey(url) && mint.trusted);
        if (!connected) {
          const key = mintUrlKey(url);
          let connection = pendingMintConnections.current.get(key);
          if (!connection) {
            connection = connectMint(url);
            pendingMintConnections.current.set(key, connection);
            const clear = () => pendingMintConnections.current.delete(key);
            void connection.then(clear, clear);
          }
          await withTimeout(connection, 12_000);
        }
      }
      if (isImportingFlow) holdRecoveryPause();
      setFinishingStatus('Finalizing setup…');
      startSetupStep('finish');
      await completeOnboarding();
      useAuthStore.getState().setAuthenticated(true);
    } catch (err) {
      setSetupProgress((steps) =>
        steps.map((step) => ({
          ...step,
          status: step.status === 'running' ? 'error' : step.status,
        })),
      );
      releaseRecoveryPause();
      appLogger.error('[Onboarding] Onboarding completion failed:', err, 'wallet_start');
      setSetupError(
        setupPrepared.current
          ? 'Your wallet is saved. Retry connecting, or skip username and mints to open it now.'
          : 'Setup could not finish. Please try again.',
      );
    } finally {
      resumeRecoveryWork?.();
      finishLock.current = false;
      setIsFinishing(false);
    }
  };

  // ── Seed import (restore flow) ──────────────────────────────

  const handleImportSeed = async (
    mnemonic: string,
    options: {
      additionalMints?: string[];
      backupState?: any;
    } = {},
  ) => {
    const { additionalMints = [], backupState } = options;
    setIsImportingFlow(true);
    setIsImporting(true);
    setImportStatus('Initializing wallet…');
    try {
      // Check Nostr for mint backups
      let nostrMints: string[] = [];
      let keys: any = null;
      try {
        setImportStatus('Checking for Nostr backups…');
        keys = await seedService.getNostrKeys(mnemonic);
        const pubkeyHex = keys.pubkey;
        nostrMints = await nostrService.fetchMintsFromNostr(pubkeyHex, { throwOnFailure: true });

        setDiscoveryMessage(
          nostrMints.length || additionalMints.length
            ? undefined
            : 'No backup found. Review the available mints.',
        );
        if (nostrMints.length > 0) {
        }
      } catch (err) {
        setDiscoveryMessage('Backup discovery failed. You can retry.');
        appLogger.warn('[Onboarding] Failed to fetch Nostr backup mints:', err, 'wallet_start');
      }

      if (!keys) {
        keys = await seedService.getNostrKeys(mnemonic);
      }

      const pubkeyHex = keys.pubkey;

      // Remote NIP-05 username lookup
      let fetchedUsername: string | null = null;
      try {
        setImportStatus('Checking for registered username…');
        const response = await fetch('https://bey.cash/.well-known/nostr.json');
        if (response.ok) {
          const data = await response.json();
          const names = data?.names || {};
          for (const [name, val] of Object.entries(names)) {
            if (typeof val === 'string' && val.toLowerCase() === pubkeyHex.toLowerCase()) {
              fetchedUsername = name;
              break;
            }
          }
        }
      } catch (err) {
        appLogger.warn('[Onboarding] Remote NIP-05 lookup failed:', err, 'wallet_start');
      }

      if (fetchedUsername) {
        setTempUsername(fetchedUsername);
      } else {
        const genName = generateDeterministicUsername(pubkeyHex);
        setTempUsername(genName);
      }

      // Save variables for execution inside handlePermissionsComplete
      setGeneratedMnemonic(mnemonic);
      setTempNpub(keys.npub);
      setTempBackupState(backupState);

      setExtraRestoreMints(additionalMints);
      setNostrRestoreMints(nostrMints);

      setIsImporting(false);
      setStep('permissions');
    } catch (err) {
      appLogger.error('[Onboarding] Import failed:', err, 'wallet_start');
      setImportStatus('Import failed. Please try again.');
      setSetupError(interactionCopy.importFailedPleaseTryAgain.title);
      setIsImporting(false);
    }
  };

  // ── File import (restore from .bey backup file) ─────────────

  const handleImportFromFile = async (uri: string) => {
    if (busy || finishLock.current) return;
    finishLock.current = true;
    setIsImporting(true);
    setSetupError(null);
    setImportStatus('Reading backup…');
    const resumeRecoveryWork = recoveryCoordinator.pause();
    try {
      // The entry screen invokes this only after file selection and risk acceptance.
      const backup = await walletFileService.readWalletBackupFile(uri);
      await fileRestoreService.prepare(backup);
    } catch (err: any) {
      const message = err?.message ?? 'Failed to import wallet from file.';
      if (message !== 'File selection was cancelled.') {
        setSetupError(
          'Could not import this backup. Choose a valid Bey backup file and try again.',
        );
      }
    } finally {
      resumeRecoveryWork();
      finishLock.current = false;
      setIsImporting(false);
    }
  };

  // ── Step router ─────────────────────────────────────────────

  const insets = useSafeAreaInsets();
  const renderStep = () => {
    switch (currentStep) {
      case 'creating':
      case 'welcome':
      default:
        return (
          <Flex fill bg="$background" pb={insets.bottom || 16}>
            <WelcomeStep
              busy={busy}
              isSettingUp={isFinishing && savedWalletAction === 'open'}
              isDeleting={isFinishing && savedWalletAction === 'delete'}
              onCreateWallet={handleCreateWallet}
              onImportWallet={handleImportWallet}
              hasSavedWallet={hasSavedWallet}
              onOpenSavedWallet={handleResumeRestore}
              onDeleteSavedWallet={handleDeleteSavedWallet}
            />
            <WalletCreationTask
              open={currentStep === 'creating'}
              onError={() => {
                setSetupError(interactionCopy.walletCreationFailedPleaseTryAgain.title);
                setStep('welcome');
              }}
              onComplete={handleCreatingComplete}
              generateMnemonic={seedService.generateMnemonic}
            />
          </Flex>
        );

      case 'consent':
        return (
          <ConsentStep
            isBusy={busy}
            onComplete={handleConsentComplete}
            onBack={() => setStep('welcome')}
          />
        );

      case 'permissions':
        return (
          <PermissionsStep
            isFinishing={isFinishing}
            setupProgress={setupProgress}
            canSkipOptional={canSkipOptional}
            initialUsername={tempUsername}
            npub={tempNpub}
            onComplete={handlePermissionsComplete}
          />
        );

      case 'import':
        return (
          <ImportSeedStep
            isImporting={isImporting}
            onImport={(mnemonic) => handleImportSeed(mnemonic, {})}
            onImportFromFile={handleImportFromFile}
            onBack={() => setStep('welcome')}
          />
        );
    } // close switch
  }; // close renderStep

  return (
    <YStack flex={1}>
      {setupError && (
        <Text color="$red10" p="$4" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {setupError}
        </Text>
      )}
      {renderStep()}
    </YStack>
  );
}
