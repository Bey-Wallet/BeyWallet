import React from 'react';
import { useSettingsStore, type ThemePreference } from '~/state/settingsStore';
import { SELECTABLE_CURRENCIES } from '~/services/wallet/currencyService';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

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

export function CurrencySettingsScreen() {
  const currency = useSettingsStore((state) => state.secondaryCurrency);
  const setCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose the currency used for fiat conversions, or hide the conversion.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsRow
          title="None"
          description="Show sats only"
          selected={currency === 'NONE'}
          onPress={() => void setCurrency('NONE')}
        />
        {SELECTABLE_CURRENCIES.map((item) => (
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
