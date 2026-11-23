import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { Copy, EyeOff, FileDown, FileUp, Trash2 } from '~/shared/icons';
import { seedService } from '~/services/platform/seedService';
import { biometricService } from '~/services/platform/biometricService';
import { walletFileService } from '~/services/platform/walletFileService';
import { initService } from '~/services/wallet';
import { useSettingsStore } from '~/state/settingsStore';
import { AppButton } from '~/shared/ui/AppButton';
import { SettingsDescription, SettingsMessage, SettingsPage } from './components/SettingsLayout';
import { useProtectedValue } from './hooks/useProtectedValue';
import { useSettingsOperation } from './hooks/useSettingsOperation';
import { fileRestoreService } from '~/services/wallet/fileRestoreService';

export function RecoveryPhraseSettingsScreen() {
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
          <YStack rounded="$6" bg="$gray2" p="$4" gap="$3">
            <XStack flexWrap="wrap" gap="$3">
              {secret.value.split(' ').map((word, index) => (
                <XStack key={index} width="45%" gap="$2" py="$1" items="baseline">
                  <Text color="$gray10" minWidth={32} flexShrink={0} numberOfLines={1}>
                    {`${index + 1}.`}
                  </Text>
                  <Text color="$color" fontWeight="600" flex={1} minWidth={0}>
                    {word}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <XStack gap="$3" width="100%">
            <AppButton
              variant="default"
              emphasis="secondary"
              icon={Copy}
              flex={1}
              fullWidth={false}
              accessibilityLabel="Copy recovery phrase"
              onPress={() => (secret.value ? void operation.copy(secret.value) : undefined)}
            >
              Copy
            </AppButton>
            <AppButton
              variant="default"
              emphasis="secondary"
              icon={EyeOff}
              flex={1}
              fullWidth={false}
              accessibilityLabel="Hide recovery phrase"
              onPress={secret.hide}
            >
              Hide
            </AppButton>
          </XStack>
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
        haptic
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
            const { secondaryCurrency, theme } = useSettingsStore.getState();
            const filename = await walletFileService.exportWallet(mnemonic, {
              mints: state.mints,
              keysets: state.keysets,
              proofs: state.proofs,
              counters: state.counters,
              history: state.history,
              mintQuotes: state.mintQuotes,
              changeOperations: state.changeOperations,
              sendOperations: state.sendOperations,
              meltOperations: state.meltOperations,
              meltQuotes: state.meltQuotes,
              keypairs: state.keypairs,
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
      'Prepare backup restore',
      'We will check the backup first. The same recovery phrase merges missing records. A different phrase replaces your wallet only after you finish and confirm. Keep an export of your current wallet to retain access to its separate funds.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function RestoreBackupSettingsScreen() {
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsMessage>
        The same recovery phrase merges missing records. A different recovery phrase replaces the
        wallet after confirmation. Balances are not combined when replacing a wallet.
      </SettingsMessage>
      <SettingsDescription>
        Choose a previously exported Bey Wallet backup. Authentication and confirmation are required
        before the file picker opens.
      </SettingsDescription>
      <AppButton
        haptic
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
            await fileRestoreService.prepare(backup);
            return 'Backup prepared. Review the restore before finishing.';
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
        This permanently deletes the recovery phrase, ecash, pending payments, mints, history and
        settings on this device. Save a backup first. Files saved outside Bey are kept.
      </SettingsMessage>
      {secret.value ? (
        <>
          <YStack bg="$gray2" rounded="$6" p="$4" gap="$3">
            <Text fontSize="$5" fontWeight="600">
              Recovery phrase
            </Text>
            <XStack flexWrap="wrap" gap="$3">
              {secret.value.map((word, index) => (
                <XStack key={index} width="45%" gap="$2" items="baseline">
                  <Text color="$gray10" minWidth={32} flexShrink={0} numberOfLines={1}>
                    {`${index + 1}.`}
                  </Text>
                  <Text color="$color" flex={1} minWidth={0}>
                    {word}
                  </Text>
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
            haptic
            variant="critical"
            icon={Trash2}
            loading={task.busy}
            loadingText="Deleting wallet…"
            onPress={() =>
              void task.run(async () => {
                await initService.destroyWallet();
                secret.hide();
                return 'Wallet deleted.';
              }, 'Wallet deletion did not finish. Retry deleting the wallet, or restart Bey to finish the reset.')
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
