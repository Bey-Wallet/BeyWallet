import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { settingsCategories, type SettingsCategory } from './settingsCatalog';
import { NostrHealthRow } from './components/NostrHealthRow';
import { SettingsToggleRow } from './components/SettingsToggleRow';
import { biometricService } from '~/services/platform/biometricService';
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
    currency: settings.secondaryCurrency === 'NONE' ? 'None' : settings.secondaryCurrency,
    mints: String(mints.length),
    'fallback-mint': settings.defaultMintUrl
      ? settings.defaultMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      : 'None',
    'receiving-policy': policy === 'ask' ? 'Ask first' : 'Everyone',
    'recovery-phrase': settings.seedBackedUp ? 'Backed up' : 'Not confirmed',
  };
  const toggles: Record<
    string,
    {
      checked: boolean;
      description?: string;
      save: (next: boolean) => Promise<void>;
      requiresApproval?: boolean;
    }
  > = {
    'bitcoin-symbol': {
      checked: settings.showBitcoinSymbol,
      description: 'Use ₿ instead of the sat label',
      save: settings.setShowBitcoinSymbol,
    },
    notifications: {
      checked: settings.notificationsEnabled,
      save: settings.setNotificationsEnabled,
    },
    'hide-balance': { checked: settings.hideBalance, save: settings.setHideBalance },
    'app-lock': {
      checked: settings.biometricEnabled,
      requiresApproval: true,
      save: async (next) => {
        const authorized = await biometricService.authenticateAsync(
          next
            ? 'Enable biometric security for Bey Wallet'
            : 'Authenticate to disable biometric security',
        );
        if (!authorized) throw new Error('Authentication required');
        await settings.setBiometricEnabled(next);
      },
    },
  };
  const items = settingsCategories[category].items;
  const row = (item: (typeof items)[number]) =>
    item.path === 'nostr-health' ? (
      <NostrHealthRow key={item.path} />
    ) : toggles[item.path] ? (
      <SettingsToggleRow key={item.path} {...item} {...toggles[item.path]} />
    ) : (
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
