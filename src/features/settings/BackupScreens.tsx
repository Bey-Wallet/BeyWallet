import React, { useCallback } from 'react';
import { Alert, DevSettings } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Copy, EyeOff, FileDown, FileUp, ShieldCheck, Trash2 } from '@tamagui/lucide-icons';
import { seedService } from '~/services/platform/seedService';
import { biometricService } from '~/services/platform/biometricService';
import { walletFileService } from '~/services/platform/walletFileService';
import { initService } from '~/services/wallet';
import { useSettingsStore } from '~/state/settingsStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { AppButton } from '~/shared/ui/AppButton';
import { SettingsDescription, SettingsMessage, SettingsPage } from './components/SettingsLayout';
import { useProtectedValue } from './hooks/useProtectedValue';
import { useSettingsOperation } from './hooks/useSettingsOperation';

export function RecoveryPhraseSettingsScreen() {
  const backedUp = useSettingsStore((state) => state.seedBackedUp);
  const secret = useProtectedValue(
    'Authorize to view your secret backup phrase',
    useCallback(async () => {
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) throw new Error('Recovery phrase unavailable');
      await useSettingsStore.getState().setBackupDismissedAt(Date.now());
      return mnemonic;
    }, []),
  );
  const operation = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsMessage>
        Never share your recovery phrase. Anyone with these words can access your funds. Store them
        offline in a secure location.
      </SettingsMessage>
      {secret.value ? (
        <>
          <YStack rounded="$6" bg="$buttonDefaultSecondary" p="$4" gap="$3">
            <XStack flexWrap="wrap" gap="$3">
              {secret.value.split(' ').map((word, index) => (
                <XStack key={index} width="45%" gap="$2" py="$1">
                  <Text color="$gray10" width={24}>
                    {index + 1}.
                  </Text>
                  <Text color="$color" fontWeight="600">
                    {word}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <AppButton
            variant="default"
            emphasis="secondary"
            icon={Copy}
            onPress={() => (secret.value ? void operation.copy(secret.value) : undefined)}
          >
            Copy recovery phrase
          </AppButton>
          <AppButton variant="default" emphasis="secondary" icon={EyeOff} onPress={secret.hide}>
            Hide phrase
          </AppButton>
          <AppButton
            icon={ShieldCheck}
            loading={operation.busy}
            onPress={() =>
              void operation.run(async () => {
                await SecureStore.setItemAsync('wallet_backed_up', 'true');
                await useSettingsStore.getState().setSeedBackedUp(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return 'Recovery phrase backup confirmed.';
              })
            }
          >
            {backedUp ? 'Backup confirmed' : 'I saved my recovery phrase'}
          </AppButton>
        </>
      ) : (
        <AppButton loading={secret.busy} onPress={secret.reveal}>
          Reveal recovery phrase
        </AppButton>
      )}
      {secret.error && <SettingsMessage error>{secret.error}</SettingsMessage>}
      {operation.message && (
        <SettingsMessage error={operation.error}>{operation.message}</SettingsMessage>
      )}
    </SettingsPage>
  );
}

export function ExportBackupSettingsScreen() {
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsDescription>
        Export your recovery phrase and complete wallet data to a backup file. Keep this file
        private. It becomes out of date as you use your wallet.
      </SettingsDescription>
      <SettingsMessage>
        This backup includes spendable ecash. Store it securely and never share it.
      </SettingsMessage>
      <AppButton
        icon={FileUp}
        loading={task.busy}
        loadingText="Exporting backup…"
        onPress={() =>
          void task.run(async () => {
            if (
              !(await biometricService.authenticateAsync(
                'Authenticate to export your wallet backup',
              ))
            )
              return 'Export cancelled.';
            const mnemonic = await seedService.getMnemonic();
            if (!mnemonic) throw new Error('Recovery phrase unavailable');
            const { backupService } =
              require('~/services/wallet/backupService') as typeof import('~/services/wallet/backupService');
            const state = await backupService.exportState();
            const { defaultMintUrl, secondaryCurrency, theme } = useSettingsStore.getState();
            const filename = await walletFileService.exportWallet(mnemonic, {
              mints: state.mints,
              keysets: state.keysets,
              proofs: state.proofs,
              counters: state.counters,
              history: state.history,
              mintQuotes: state.mintQuotes,
              changeOperations: state.changeOperations,
              defaultMintUrl,
              secondaryCurrency,
              theme,
            });
            return `Backup exported: ${filename}`;
          })
        }
      >
        Export backup
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}

function confirmRestore() {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      'Confirm restore',
      'This will replace your current wallet data with the backup. This cannot be undone. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Restore', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function RestoreBackupSettingsScreen() {
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsMessage error>
        Restoring replaces the wallet on this device, including its proofs, mints, and history.
        Export your current wallet before continuing.
      </SettingsMessage>
      <SettingsDescription>
        Choose a previously exported Bey Wallet backup. Authentication and confirmation are required
        before the file picker opens.
      </SettingsDescription>
      <AppButton
        icon={FileDown}
        variant="warning"
        loading={task.busy}
        loadingText="Restoring wallet…"
        onPress={() =>
          void task.run(async () => {
            if (!(await biometricService.authenticateAsync('Authenticate to import wallet backup')))
              return 'Restore cancelled.';
            if (!(await confirmRestore())) return 'Restore cancelled.';
            let backup;
            try {
              backup = await walletFileService.importWalletFromFile();
            } catch (error) {
              if (error instanceof Error && error.message === 'File selection was cancelled.')
                return 'Restore cancelled.';
              throw error;
            }
            await initService.destroyWallet();
            await initService.restoreWallet(backup.mnemonic, { quiet: true });
            const { backupService } =
              require('~/services/wallet/backupService') as typeof import('~/services/wallet/backupService');
            await backupService.importState({
              mints: backup.mints,
              keysets: backup.keysets,
              proofs: backup.proofs,
              counters: backup.counters,
              history: backup.history,
              mintQuotes: backup.mintQuotes,
              changeOperations: backup.changeOperations,
              sendOperations: [],
              meltOperations: [],
            });
            await initService.reinitFast();
            const settings = useSettingsStore.getState();
            if (backup.secondaryCurrency)
              await settings.setSecondaryCurrency(backup.secondaryCurrency);
            if (backup.theme) await settings.setTheme(backup.theme);
            if (backup.defaultMintUrl) await settings.setDefaultMintUrl(backup.defaultMintUrl);
            Alert.alert(
              'Restore completed',
              'Your wallet has been restored successfully. Please restart the app.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (__DEV__ && DevSettings?.reload) DevSettings.reload();
                  },
                },
              ],
            );
            return 'Wallet restored. Restart the app to continue.';
          })
        }
      >
        Choose backup to restore
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}

export function DeleteWalletSettingsScreen() {
  const secret = useProtectedValue(
    'Authenticate to delete your wallet',
    useCallback(async () => {
      const mnemonic = await seedService.getMnemonic();
      return mnemonic?.split(' ') ?? [];
    }, []),
  );
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsMessage error>
        This permanently deletes all wallet data on this device, including proofs, mints, and
        history. Back up your recovery phrase and wallet data before proceeding.
      </SettingsMessage>
      {secret.value ? (
        <>
          <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4" gap="$3">
            <Text fontSize="$5" fontWeight="600">
              Recovery phrase
            </Text>
            <XStack flexWrap="wrap" gap="$3">
              {secret.value.map((word, index) => (
                <XStack key={index} width="45%" gap="$2">
                  <Text color="$gray10">{index + 1}.</Text>
                  <Text color="$color">{word}</Text>
                </XStack>
              ))}
            </XStack>
            {secret.value.length === 0 && (
              <SettingsDescription>
                No recovery phrase is available on this device.
              </SettingsDescription>
            )}
          </YStack>
          <AppButton
            variant="default"
            emphasis="secondary"
            icon={Copy}
            disabled={task.busy || secret.value.length === 0}
            onPress={() => (secret.value ? void task.copy(secret.value.join(' ')) : undefined)}
          >
            Copy recovery phrase
          </AppButton>
          <AppButton
            variant="critical"
            icon={Trash2}
            loading={task.busy}
            loadingText="Deleting wallet…"
            onPress={() =>
              void task.run(async () => {
                await initService.destroyWallet();
                await useOnboardingStore.getState().resetOnboarding();
                secret.hide();
                if (__DEV__ && DevSettings?.reload) DevSettings.reload();
                else Alert.alert('Wallet deleted', 'Please restart the app to complete the reset.');
                return 'Wallet deleted. Restart the app to complete the reset.';
              })
            }
          >
            I’ve backed up, delete everything
          </AppButton>
          <AppButton
            variant="default"
            emphasis="secondary"
            disabled={task.busy}
            onPress={secret.hide}
          >
            Cancel
          </AppButton>
        </>
      ) : (
        <AppButton variant="critical" loading={secret.busy} onPress={secret.reveal}>
          Authenticate to continue
        </AppButton>
      )}
      {secret.error && <SettingsMessage error>{secret.error}</SettingsMessage>}
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}
