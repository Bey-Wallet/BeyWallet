import React, { useCallback, useState } from 'react';
import { Text, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import { Copy, EyeOff } from '@tamagui/lucide-icons';
import { useSettingsStore } from '~/state/settingsStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { AppButton } from '~/shared/ui/AppButton';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';
import { useProtectedValue } from './hooks/useProtectedValue';
import { useSettingsOperation } from './hooks/useSettingsOperation';

export function PublicKeySettingsScreen() {
  const task = useSettingsOperation();
  const npub = useSettingsStore((state) => state.npub);
  const [copied, setCopied] = useState(false);
  return (
    <SettingsPage>
      <SettingsDescription>
        Your public Nostr key identifies you. It is safe to share.
      </SettingsDescription>
      <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4">
        <Text selectable color="$color">
          {npub || 'Public key unavailable.'}
        </Text>
      </YStack>
      {!npub && (
        <>
          <SettingsMessage>
            Your identity is restored from this wallet’s recovery phrase. Retry loading it here.
          </SettingsMessage>
          <AppButton
            loading={task.busy}
            onPress={() =>
              void task.run(async () => {
                await useSettingsStore.getState().initialize(true);
                if (!useSettingsStore.getState().npub) throw new Error('Identity unavailable');
                return 'Public key restored.';
              })
            }
          >
            Retry loading public key
          </AppButton>
        </>
      )}
      <AppButton
        icon={Copy}
        disabled={!npub}
        onPress={() =>
          void task.run(async () => {
            if (npub) {
              await Clipboard.setStringAsync(npub);
              setCopied(true);
            }
            return 'Public key copied.';
          })
        }
      >
        {copied ? 'Copied' : 'Copy public key'}
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}

export function SecretKeySettingsScreen() {
  const task = useSettingsOperation();
  const secret = useProtectedValue(
    'Authenticate to view your secret nsec',
    useCallback(async () => {
      if (!useSettingsStore.getState().nsec) {
        await useSettingsStore.getState().initialize(true);
      }
      const nsec = useSettingsStore.getState().nsec;
      if (!nsec) throw new Error('Secret key unavailable');
      return nsec;
    }, []),
  );
  const [copied, setCopied] = useState(false);
  return (
    <SettingsPage>
      <SettingsMessage error>
        Never share your Nostr secret key. Anyone with this key can act as you on Nostr.
      </SettingsMessage>
      {secret.value ? (
        <>
          <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4">
            <Text selectable color="$color">
              {secret.value}
            </Text>
          </YStack>
          <AppButton
            icon={Copy}
            variant="default"
            emphasis="secondary"
            onPress={() =>
              void task.run(async () => {
                if (secret.value) {
                  await Clipboard.setStringAsync(secret.value);
                  setCopied(true);
                }
                return 'Secret key copied.';
              })
            }
          >
            {copied ? 'Copied' : 'Copy secret key'}
          </AppButton>
          <AppButton icon={EyeOff} variant="default" emphasis="secondary" onPress={secret.hide}>
            Hide secret key
          </AppButton>
        </>
      ) : (
        <AppButton loading={secret.busy} onPress={secret.reveal}>
          Reveal secret key
        </AppButton>
      )}
      {secret.error && <SettingsMessage error>{secret.error}</SettingsMessage>}
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}

export function ReceivingPolicySettingsScreen() {
  const policy = useNostrReceiveSettingsStore((state) => state.policy);
  const setPolicy = useNostrReceiveSettingsStore((state) => state.setPolicy);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose how to handle incoming ecash from people you have not accepted. Mint approval is
        always separate.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsRow
          title="Ask first"
          description="Review incoming requests from unknown people."
          selected={policy === 'ask'}
          onPress={() => setPolicy('ask')}
        />
        <SettingsRow
          title="Accept everyone"
          description="Also accepts requests that are already waiting."
          selected={policy === 'everyone'}
          onPress={() => setPolicy('everyone')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}

export { BlockedPeopleSettingsScreen } from './BlockedPeopleSettingsScreen';
