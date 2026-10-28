import React from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { AtSign, Download, Zap } from '@tamagui/lucide-icons';
import { AppButton } from '~/shared/ui/AppButton';
import { useSettingsStore } from '~/state/settingsStore';
import { useLightningAddressStore } from '~/state/lightningAddressStore';
import { getLightningAddressService } from '~/services/wallet/lightningAddressLifecycle';
import { LightningAddressError } from '~/services/wallet/lightningAddressService';
import { lightningAddress, LEGACY_NPUB_CASH } from '~/services/api/npubCashClient';
import { initService } from '~/services/wallet/initService';
import {
  SettingsPage,
  SettingsGroup,
  SettingsRow,
  SettingsDescription,
  SettingsMessage,
} from './components/SettingsLayout';
import { SettingsToggleRow } from './components/SettingsToggleRow';
import { useSettingsBusy } from './hooks/useSettingsBusy';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { useAppToast } from '~/shared/hooks/useAppToast';

function useOperation() {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const active = React.useRef(false);
  useSettingsBusy(busy);
  const run = async (action: () => Promise<unknown>) => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof LightningAddressError
          ? error.message
          : 'Could not complete this action. Check your connection, unlock the wallet, and try again.',
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  };
  return { busy, message, run };
}

export default function LightningAddressSettingsScreen() {
  const toast = useAppToast();
  const state = useLightningAddressStore();
  const npub = useSettingsStore((s) => s.npub);
  const router = useRouter();
  const { busy, message, run } = useOperation();
  return (
    <SettingsPage>
      <SettingsDescription>
        Receive Lightning as ecash at a dedicated mint. Choose a receiving mint before enabling your
        address.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsToggleRow
          title="Enable Lightning address"
          icon={AtSign}
          checked={state.enabled}
          requiresApproval
          save={async (enabled) => {
            if (enabled && !state.receivingMint) {
              router.push('/(tabs)/settings/lightning-address-mint' as Href);
              return;
            }
            const service = getLightningAddressService();
            await (enabled ? service.enable() : service.disable());
          }}
        />
        <SettingsRow
          title="Receiving mint"
          value={state.receivingMint || 'Choose mint'}
          onPress={() => router.push('/(tabs)/settings/lightning-address-mint' as Href)}
        />
        <SettingsToggleRow
          title="Automatically collect payments"
          icon={Download}
          checked={state.autoCollect}
          save={(enabled) => getLightningAddressService().setAutoCollect(enabled)}
        />
      </SettingsGroup>
      {npub && state.receivingMint && (
        <YStack gap="$3">
          <Text fontSize={14} color="$color" selectable>
            {lightningAddress(npub)}
          </Text>
          <AppButton
            size="small"
            disabled={busy}
            onPress={() => run(() => toast.copy(lightningAddress(npub)))}
          >
            Copy address
          </AppButton>
        </YStack>
      )}
      <SettingsDescription>
        Disabling stops listening and collection. It does not revoke an address already shared.
        Pending payments are preserved.
      </SettingsDescription>
      <YStack gap="$1" accessibilityLiveRegion="polite">
        <Text fontSize={14} color="$gray10">
          {state.connection}
        </Text>
        <Text fontSize={12} color="$gray10">
          {state.lastChecked
            ? `Last successful check: ${new Date(state.lastChecked).toLocaleString()}`
            : 'No successful check yet'}
        </Text>
      </YStack>
      <AppButton
        size="small"
        disabled={busy || !state.enabled}
        onPress={() => run(() => getLightningAddressService().sync())}
      >
        Check for payments
      </AppButton>
      {state.pending.length > 0 && (
        <SettingsGroup>
          <SettingsRow
            title="Pending incoming payments"
            value={String(state.pending.length)}
            onPress={() => router.push('/(tabs)/settings/lightning-address-payments' as Href)}
          />
        </SettingsGroup>
      )}
      <AppButton
        size="small"
        emphasis="ghost"
        disabled={busy}
        onPress={() => run(() => getLightningAddressService().sync(LEGACY_NPUB_CASH))}
      >
        Check previous npubx.cash address
      </AppButton>
      <SettingsDescription>
        Checks the previous provider separately. Its account settings remain unchanged. Enable
        collection to collect recovered payments.
      </SettingsDescription>
      {message && <SettingsMessage error>{message}</SettingsMessage>}
    </SettingsPage>
  );
}

export function LightningAddressMintScreen() {
  const router = useRouter();
  const state = useLightningAddressStore();
  const [mints, setMints] = React.useState<string[]>([]);
  const { busy, message, run } = useOperation();
  React.useEffect(() => {
    let active = true;
    void initService
      .getRepo()
      .mintRepository.getAllMints()
      .then((items) => {
        if (active) setMints(items.filter((m) => m.trusted).map((m) => m.mintUrl));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <SettingsPage>
      <Stack.Screen options={{ title: 'Receiving mint' }} />
      <SettingsDescription>
        Choose a connected, trusted SAT mint. Bey checks Lightning minting and recovery support
        before saving it with npub.cash. Changes affect future invoices; existing payments stay at
        their original mint.
      </SettingsDescription>
      <SettingsGroup>
        {mints.map((mint) => (
          <SettingsRow
            key={mint}
            title={mint}
            icon={Zap}
            selected={mint === state.receivingMint}
            disabled={busy}
            onPress={() => run(() => getLightningAddressService().setReceivingMint(mint))}
          />
        ))}
      </SettingsGroup>
      {!state.enabled && !!state.receivingMint && (
        <AppButton
          size="small"
          disabled={busy}
          onPress={() =>
            run(async () => {
              await getLightningAddressService().enable();
              router.back();
            })
          }
        >
          Enable Lightning address
        </AppButton>
      )}
      {!mints.length && (
        <SettingsDescription>
          Connect and trust a compatible mint in Connected mints first.
        </SettingsDescription>
      )}
      {message && <SettingsMessage error>{message}</SettingsMessage>}
    </SettingsPage>
  );
}

export function LightningAddressPaymentsScreen() {
  const state = useLightningAddressStore();
  useFeedbackOwner(state.pending.map((receipt) => receipt.quoteId));
  const { busy, message, run } = useOperation();
  return (
    <SettingsPage>
      <Stack.Screen options={{ title: 'Pending incoming payments' }} />
      <SettingsDescription>
        Payments stay pending until their ecash proofs are safely saved to this wallet.
      </SettingsDescription>
      {!!state.pending.length && (
        <AppButton
          size="small"
          disabled={busy || !state.enabled}
          onPress={() => run(() => getLightningAddressService().collectAll())}
        >
          Collect all
        </AppButton>
      )}
      <SettingsGroup>
        {state.pending.map((receipt) => (
          <YStack key={`${receipt.mintUrl}:${receipt.quoteId}`} p="$4" gap="$2">
            <Text fontSize={14} color="$color">
              {receipt.amount} sat
            </Text>
            <Text fontSize={12} color="$gray10">
              {receipt.mintUrl}
            </Text>
            <Text fontSize={12} color="$gray10">
              {receipt.providers.map((provider) => new URL(provider).host).join(', ')}
            </Text>
            {receipt.issue && (
              <Text fontSize={12} color="$gray10">
                {receipt.issue}
              </Text>
            )}
            <AppButton
              size="small"
              disabled={busy || !state.enabled}
              onPress={() =>
                run(() => getLightningAddressService().collect(receipt.mintUrl, receipt.quoteId))
              }
            >
              Collect
            </AppButton>
          </YStack>
        ))}
      </SettingsGroup>
      {!state.pending.length && <SettingsDescription>No pending payments.</SettingsDescription>}
      {!state.enabled && (
        <SettingsDescription>Enable Lightning address to collect payments.</SettingsDescription>
      )}
      {message && <SettingsMessage error>{message}</SettingsMessage>}
    </SettingsPage>
  );
}
