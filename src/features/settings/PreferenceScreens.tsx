import React, { useState } from 'react';
import { AppInput } from '~/shared/ui/AppInput';
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
  const [search, setSearch] = useState('');
  const currency = useSettingsStore((state) => state.secondaryCurrency);
  const setCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  const query = search.trim().toLowerCase();
  const options = [
    { code: 'NONE', name: 'None', description: 'Show sats only' },
    ...SELECTABLE_CURRENCIES.map(({ code, name }) => ({
      code: String(code),
      name,
      description: undefined as string | undefined,
    })),
  ]
    .filter((item) =>
      `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(query),
    )
    .sort((a, b) => Number(b.code === currency) - Number(a.code === currency));
  return (
    <SettingsPage keyboardShouldPersistTaps="handled">
      <SettingsDescription>
        Choose the currency used for fiat conversions, or hide the conversion.
      </SettingsDescription>
      <AppInput
        accessibilityLabel="Search currencies"
        placeholder="Search name or code"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {options.length ? (
        <SettingsGroup>
          {options.map((item) => (
            <SettingsRow
              key={item.code}
              title={item.name}
              value={item.code === 'NONE' ? undefined : item.code}
              description={item.description}
              selected={currency === item.code}
              onPress={() => void setCurrency(item.code)}
            />
          ))}
        </SettingsGroup>
      ) : (
        <SettingsDescription>No currencies found. Try another name or code.</SettingsDescription>
      )}
    </SettingsPage>
  );
}
