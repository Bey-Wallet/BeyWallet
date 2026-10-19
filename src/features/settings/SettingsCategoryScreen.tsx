import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { settingsCategories, type SettingsCategory } from './settingsCatalog';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

export function SettingsCategoryScreen({ category }: { category: SettingsCategory }) {
  const router = useRouter();
  const settings = useSettingsStore();
  const mints = useWalletStore((state) => state.mints);
  const policy = useNostrReceiveSettingsStore((state) => state.policy);
  const summaries: Record<string, string | undefined> = {
    theme: settings.theme === 'system' ? 'System' : settings.theme === 'dark' ? 'Dark' : 'Light',
    'display-unit': settings.primaryCurrency === 'SATS' ? 'Sats' : 'Fiat',
    currency: settings.secondaryCurrency === 'NONE' ? 'None' : settings.secondaryCurrency,
    'bitcoin-symbol': settings.showBitcoinSymbol ? '₿' : 'sats',
    notifications: settings.notificationsEnabled ? 'On' : 'Off',
    'app-lock': settings.biometricEnabled ? 'On' : 'Off',
    'hide-balance': settings.hideBalance ? 'On' : 'Off',
    mints: String(mints.length),
    'fallback-mint': settings.defaultMintUrl
      ? settings.defaultMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      : 'None',
    'receiving-policy': policy === 'ask' ? 'Ask first' : 'Everyone',
    'recovery-phrase': settings.seedBackedUp ? 'Backed up' : 'Not confirmed',
  };
  const items = settingsCategories[category].items;
  const row = (item: (typeof items)[number]) => (
    <SettingsRow
      key={item.path}
      {...item}
      value={summaries[item.path]}
      onPress={() => router.push(`/(tabs)/settings/${item.path}` as Href)}
    />
  );
  return (
    <SettingsPage>
      {category === 'advanced' && (
        <SettingsDescription>
          Inspect your wallet’s ecash proofs and verify mint signatures. These tools are intended
          for troubleshooting.
        </SettingsDescription>
      )}
      <SettingsGroup>
        {items.filter((item) => item.path !== 'delete-wallet').map(row)}
      </SettingsGroup>
      {category === 'security' && (
        <SettingsGroup>
          {items.filter((item) => item.path === 'delete-wallet').map(row)}
        </SettingsGroup>
      )}
    </SettingsPage>
  );
}
