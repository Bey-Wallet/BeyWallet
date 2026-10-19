import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Input, Text, XStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import { Copy, Plus, Radio, RefreshCw, RotateCcw, Trash2 } from '@tamagui/lucide-icons';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { nostrService } from '~/services/wallet/nostrService';
import { useNostrRelayStore } from '~/state/nostrRelayStore';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
} from './components/SettingsLayout';

export function RelaySettingsScreen() {
  const relays = useNostrRelayStore((state) => state.relays);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  useFocusEffect(
    useCallback(() => {
      const poll = () => setConnections(nostrService.getRelayConnectionStatus());
      poll();
      const timer = setInterval(poll, 1000);
      return () => clearInterval(timer);
    }, [relays]),
  );
  const change = (action: () => void) => {
    setError(null);
    setMessage(null);
    try {
      action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update relays.');
    }
  };
  return (
    <SettingsPage>
      <SettingsDescription>
        Manage your Nostr relays. Changes reconnect automatically. Recipient inbox relays may also
        be used for delivery.
      </SettingsDescription>
      <SettingsGroup>
        {relays.map((relay) => (
          <XStack key={relay} px="$4" py="$3" minHeight={56} gap="$3" items="center">
            <Radio
              size={20}
              color={connections[relay] ? '$green10' : '$red10'}
              accessibilityRole="image"
              accessibilityLabel={connections[relay] ? 'Connected' : 'Disconnected'}
            />
            <Text flex={1} fontSize="$4" color="$color">
              {relay}
            </Text>
            <AppIconButton
              icon={Copy}
              variant="default"
              emphasis="tertiary"
              size="xxsmall"
              accessibilityLabel={`Copy ${relay}`}
              onPress={async () => {
                setError(null);
                setMessage(null);
                try {
                  await Clipboard.setStringAsync(relay);
                  setMessage('Relay URL copied.');
                } catch {
                  setError('Could not copy relay URL.');
                }
              }}
            />
            <AppIconButton
              icon={Trash2}
              variant="critical"
              emphasis="tertiary"
              size="xxsmall"
              accessibilityLabel={`Remove ${relay}`}
              disabled={relays.length <= 1}
              onPress={() => change(() => useNostrRelayStore.getState().removeRelay(relay))}
            />
          </XStack>
        ))}
      </SettingsGroup>
      <XStack gap="$3" items="center">
        <Input
          flex={1}
          accessibilityLabel="Relay URL"
          placeholder="wss://relay.example"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          rounded="$6"
          color="$color"
        />
        <AppIconButton
          icon={Plus}
          variant="branded"
          emphasis="primary"
          accessibilityLabel="Add relay"
          disabled={!url.trim()}
          onPress={() =>
            change(() => {
              useNostrRelayStore.getState().addRelay(url);
              setUrl('');
            })
          }
        />
      </XStack>
      {error && <SettingsMessage error>{error}</SettingsMessage>}
      {message && <SettingsMessage>{message}</SettingsMessage>}
      <AppButton
        variant="default"
        emphasis="secondary"
        icon={RefreshCw}
        onPress={() =>
          change(() => {
            nostrService.reconnectRelays();
            setConnections(nostrService.getRelayConnectionStatus());
            setMessage('Reconnect requested. Connection status updates automatically.');
          })
        }
      >
        Reconnect all relays
      </AppButton>
      <AppButton
        variant="default"
        emphasis="secondary"
        icon={RotateCcw}
        onPress={() =>
          Alert.alert('Reset relays?', 'Replace your custom list with the default relays?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              onPress: () => change(() => useNostrRelayStore.getState().resetRelays()),
            },
          ])
        }
      >
        Reset to defaults
      </AppButton>
    </SettingsPage>
  );
}
