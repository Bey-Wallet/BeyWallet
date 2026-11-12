import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import {
  settingsCategories,
  settingsCategorySections,
  type SettingsCategory,
  type SettingsItem,
} from './settingsCatalog';
import { NostrHealthRow } from './components/NostrHealthRow';
import { SettingsToggleRow } from './components/SettingsToggleRow';
import { biometricService } from '~/services/platform/biometricService';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
  SettingsSection,
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
  const row = (item: SettingsItem) =>
    item.path === 'nostr-health' ? (
      <NostrHealthRow key={item.path} />
    ) : toggles[item.path] ? (
      <SettingsToggleRow key={item.path} {...item} {...toggles[item.path]} />
    ) : (
      <SettingsRow
        key={item.path}
        {...item}
        value={summaries[item.path]}
        onPress={() =>
          router.push(
            item.path === 'recover-funds'
              ? '/recover-funds'
              : item.path === 'mints'
                ? '/(modals)/mints'
                : (`/(tabs)/settings/${item.path}` as Href),
          )
        }
      />
    );
  return (
    <SettingsPage>
      {category === 'advanced' && (
        <SettingsDescription>
          Manage network connections and message history. Wallet maintenance tools are intended for
          troubleshooting and advanced use.
        </SettingsDescription>
      )}
      {settingsCategories[category].groups.map((group, index) => (
        <SettingsSection key={group[0].path} title={settingsCategorySections[category]?.[index]}>
          <SettingsGroup>{group.map(row)}</SettingsGroup>
        </SettingsSection>
      ))}
    </SettingsPage>
  );
}
