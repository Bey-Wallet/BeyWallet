import React, { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { CloudUpload } from '@tamagui/lucide-icons';
import { useMintBackupStore } from '~/state/mintBackupStore';
import { publishMintBackup, type MintBackupResult } from '~/services/wallet/mintBackupService';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
} from './components/SettingsLayout';
import { useSettingsOperation } from './hooks/useSettingsOperation';

const messages: Record<MintBackupResult, string> = {
  published: 'Mint list published successfully.',
  offline: 'Go online to publish your mint backup.',
  empty: 'No connected trusted mints or mints with a balance to back up.',
  failed:
    'The backup was not confirmed. Your last successful backup time has not changed. Try again later.',
  disabled: 'Automatic mint backup is off.',
};

export function MintBackupSettingsScreen() {
  const backup = useMintBackupStore();
  const offline = useOfflineStatus();
  const task = useSettingsOperation();
  const [failed, setFailed] = useState(false);
  const time = (value: number | null) =>
    value ? new Date(value).toLocaleString() : 'Not recorded';
  return (
    <SettingsPage>
      <SettingsDescription>
        Publish your mint list under your Nostr identity so it can be found when recovering this
        wallet on another device. Mint URLs are public; your recovery phrase and ecash are not
        included. Keep your recovery phrase and full wallet backup separately.
      </SettingsDescription>
      <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4" gap="$2">
        <XStack gap="$3" items="center">
          <Text flex={1} color="$color" fontSize="$5">
            Automatic mint backup
          </Text>
          <AppSwitch
            variant="branded"
            checked={backup.automatic}
            onCheckedChange={backup.setAutomatic}
            accessibilityLabel="Automatic mint backup"
          />
        </XStack>
        <SettingsDescription>
          Back up quietly when you open the app and when your mint list changes.
        </SettingsDescription>
      </YStack>
      <AppButton
        icon={CloudUpload}
        loading={task.busy || backup.publishing}
        disabled={offline}
        loadingText="Publishing mint backup…"
        onPress={() =>
          void task.run(async () => {
            const result = await publishMintBackup();
            setFailed(result === 'failed');
            return messages[result];
          })
        }
      >
        Backup now
      </AppButton>
      <SettingsGroup>
        {[
          ['Last published', time(backup.lastPublishedAt)],
          ['Last attempted', time(backup.lastAttemptAt)],
          [
            'Mints in last backup',
            backup.lastPublishedAt ? String(backup.lastPublishedMintCount) : '—',
          ],
        ].map(([title, value]) => (
          <YStack key={title} px="$4" py="$3" gap="$1" minHeight={56}>
            <Text color="$color" fontSize="$4">
              {title}
            </Text>
            <Text color="$gray10" fontSize="$3">
              {value}
            </Text>
          </YStack>
        ))}
      </SettingsGroup>
      {offline && <SettingsDescription>Go online to publish a backup.</SettingsDescription>}
      {task.message && (
        <SettingsMessage error={task.error || failed}>{task.message}</SettingsMessage>
      )}
    </SettingsPage>
  );
}
