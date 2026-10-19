import React, { useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { useSettingsStore, type ThemePreference } from '~/state/settingsStore';
import { biometricService } from '~/services/platform/biometricService';
import { SUPPORTED_CURRENCIES } from '~/services/wallet/currencyService';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';
import { useSettingsBusy } from './hooks/useSettingsBusy';

function TogglePreference({
  title,
  description,
  checked,
  save,
}: {
  title: string;
  description: string;
  checked: boolean;
  save: (next: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  useSettingsBusy(busy);
  const toggle = async (next: boolean) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await save(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setError('Could not update this setting. Please try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <SettingsPage>
      <SettingsDescription>{description}</SettingsDescription>
      <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4">
        <XStack items="center" gap="$3" justify="space-between">
          <Text color="$color" fontSize="$5" flex={1}>
            {title}
          </Text>
          <AppSwitch
            checked={checked}
            onCheckedChange={toggle}
            disabled={busy}
            variant="branded"
            accessibilityLabel={title}
          />
        </XStack>
      </YStack>
      {error && <SettingsMessage error>{error}</SettingsMessage>}
    </SettingsPage>
  );
}

export function ThemeSettingsScreen() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose how Bey Wallet looks. System follows your device’s appearance.
      </SettingsDescription>
      <SettingsGroup>
        {(['system', 'light', 'dark'] as ThemePreference[]).map((value) => (
          <SettingsRow
            key={value}
            title={value[0].toUpperCase() + value.slice(1)}
            selected={theme === value}
            onPress={() => void setTheme(value)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  );
}

export function DisplayUnitSettingsScreen() {
  const primary = useSettingsStore((state) => state.primaryCurrency);
  const setPrimary = useSettingsStore((state) => state.setPrimaryCurrency);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose the main unit shown for your balance. This changes the display, not your funds.
      </SettingsDescription>
      <SettingsGroup>
        {(['SATS', 'FIAT'] as const).map((value) => (
          <SettingsRow
            key={value}
            title={value === 'SATS' ? 'Sats' : 'Fiat currency'}
            selected={primary === value}
            onPress={() => void setPrimary(value)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  );
}

export function CurrencySettingsScreen() {
  const currency = useSettingsStore((state) => state.secondaryCurrency);
  const setCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose your secondary display currency, or hide the conversion.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsRow
          title="None"
          description="Hide secondary conversion"
          selected={currency === 'NONE'}
          onPress={() => void setCurrency('NONE')}
        />
        {SUPPORTED_CURRENCIES.map((item) => (
          <SettingsRow
            key={item.code}
            title={item.name}
            value={item.code}
            selected={currency === item.code}
            onPress={() => void setCurrency(item.code)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  );
}

export function BitcoinSymbolSettingsScreen() {
  const checked = useSettingsStore((state) => state.showBitcoinSymbol);
  return (
    <TogglePreference
      title="Use ₿ symbol for sats"
      description="Display satoshi amounts with ₿ instead of the sats label."
      checked={checked}
      save={useSettingsStore.getState().setShowBitcoinSymbol}
    />
  );
}

export function HideBalanceSettingsScreen() {
  const checked = useSettingsStore((state) => state.hideBalance);
  return (
    <TogglePreference
      title="Hide balance"
      description="Hide your wallet balance from view. You can also change this from the Home screen."
      checked={checked}
      save={useSettingsStore.getState().setHideBalance}
    />
  );
}

export function NotificationSettingsScreen() {
  const checked = useSettingsStore((state) => state.notificationsEnabled);
  return (
    <TogglePreference
      title="Push notifications"
      description="Receive alerts for incoming transactions and completed ecash claims. Your device’s notification permission also applies."
      checked={checked}
      save={useSettingsStore.getState().setNotificationsEnabled}
    />
  );
}

export function AppLockSettingsScreen() {
  const checked = useSettingsStore((state) => state.biometricEnabled);
  return (
    <TogglePreference
      title="Biometric app lock"
      description="Require Face ID, fingerprint, or your device passcode to open the wallet. Authentication is required to change this setting."
      checked={checked}
      save={async (next) => {
        const authorized = await biometricService.authenticateAsync(
          next
            ? 'Enable biometric security for Bey Wallet'
            : 'Authenticate to disable biometric security',
        );
        if (!authorized) throw new Error('Authentication required');
        await useSettingsStore.getState().setBiometricEnabled(next);
      }}
    />
  );
}
