import React from 'react';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '~/state/settingsStore';
import { useBackupStatusStore } from '~/state/backupStatusStore';
import { useMintBackupStore } from '~/state/mintBackupStore';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

const time = (value: number | null) =>
  value ? new Date(value).toLocaleString() : 'Date not recorded';

export function BackupStatusScreen() {
  const router = useRouter();
  const confirmed = useSettingsStore((state) => state.seedBackedUp);
  const backup = useBackupStatusStore();
  const mints = useMintBackupStore();
  return (
    <SettingsPage>
      <SettingsGroup>
        <SettingsRow
          title="Recovery phrase"
          value={confirmed ? 'Confirmed' : 'Not confirmed'}
          description={
            confirmed ? time(backup.phraseConfirmedAt) : 'Confirm after saving your words securely.'
          }
        />
        <SettingsRow
          title="Wallet file"
          value={
            !backup.fileExportedAt
              ? 'Not recorded'
              : backup.fileExportMethod === 'saved'
                ? 'Saved'
                : 'Save not verified'
          }
          description={
            backup.fileExportedAt
              ? time(backup.fileExportedAt)
              : 'No wallet-file export recorded on this device.'
          }
        />
        <SettingsRow
          title="Mint list"
          value={mints.lastPublishedAt ? 'Published' : 'Not recorded'}
          description={
            mints.lastPublishedAt
              ? `${time(mints.lastPublishedAt)} · ${mints.lastPublishedMintCount} mints`
              : 'No successful publication recorded.'
          }
        />
      </SettingsGroup>
      <SettingsDescription>
        Wallet files include your recovery phrase, ecash, mints and wallet history at export time.
        Mint-list backups contain mint URLs only.
      </SettingsDescription>
      {backup.fileExportedAt && backup.fileExportMethod === 'share-sheet' && (
        <SettingsDescription>
          Saving an export from the share sheet cannot be verified. Keep your saved copy somewhere
          secure.
        </SettingsDescription>
      )}
      <SettingsGroup>
        <SettingsRow
          title="Recovery phrase"
          onPress={() => router.push('/(tabs)/settings/recovery-phrase')}
        />
        <SettingsRow
          title="Export wallet backup"
          onPress={() => router.push('/(tabs)/settings/export-backup')}
        />
        <SettingsRow
          title="Mint backup"
          onPress={() => router.push('/(tabs)/settings/mint-backup')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
