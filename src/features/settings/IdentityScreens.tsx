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

export function PublicKeySettingsScreen() {
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
      <AppButton
        icon={Copy}
        disabled={!npub}
        onPress={async () => {
          if (npub) {
            await Clipboard.setStringAsync(npub);
            setCopied(true);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy public key'}
      </AppButton>
    </SettingsPage>
  );
}

export function SecretKeySettingsScreen() {
  const secret = useProtectedValue(
    'Authenticate to view your secret nsec',
    useCallback(async () => {
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
            onPress={async () => {
              if (secret.value) {
                await Clipboard.setStringAsync(secret.value);
                setCopied(true);
              }
            }}
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
