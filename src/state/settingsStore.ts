import { create } from 'zustand';
import { initService } from '~/services/wallet';
import { seedService } from '~/services/platform/seedService';
import { DEFAULT_MINT } from '~/state/constants';

export type ThemePreference = 'light' | 'dark' | 'system';
export const notificationDefaults = {
  details: false,
  payments: true,
  messages: true,
  review: true,
};
export type NotificationPreferences = typeof notificationDefaults;

interface SettingsState {
  theme: ThemePreference;
  secondaryCurrency: string;
  primaryCurrency: 'SATS' | 'FIAT';
  defaultMintUrl: string;
  initialized: boolean;
  npub: string | null;
  nsec: string | null;
  nip05: string | null; // e.g. "zaheer@nostrcheck.me"
  hideBalance: boolean;
  hideMintConnectionDisclaimer: boolean;
  setHideMintConnectionDisclaimer: (hide: boolean) => Promise<void>;
  seedBackedUp: boolean;
  setSeedBackedUp: (val: boolean) => Promise<void>;
  backupDismissedAt: number;
  setBackupDismissedAt: (val: number) => Promise<void>;
  initialize: (force?: boolean) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setSecondaryCurrency: (currency: string) => Promise<void>;
  setPrimaryCurrency: (val: 'SATS' | 'FIAT') => Promise<void>;
  setDefaultMintUrl: (url: string) => Promise<void>;
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  setNotificationPreference: (
    key: keyof NotificationPreferences,
    enabled: boolean,
  ) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setNip05: (identifier: string | null) => Promise<void>;
  setHideBalance: (hide: boolean) => Promise<void>;
  showBitcoinSymbol: boolean;
  setShowBitcoinSymbol: (val: boolean) => Promise<void>;
  backupDirectoryUri: string | null;
  setBackupDirectoryUri: (uri: string | null) => Promise<void>;
  usernameClaimDismissedAt: number;
  setUsernameClaimDismissedAt: (val: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  secondaryCurrency: 'USD',
  primaryCurrency: 'SATS',
  defaultMintUrl: '',
  notificationsEnabled: true,
  notificationPreferences: { ...notificationDefaults },
  biometricEnabled: false,
  initialized: false,
  npub: null,
  nsec: null,
  nip05: null,
  hideBalance: false,
  hideMintConnectionDisclaimer: false,
  seedBackedUp: false,
  backupDismissedAt: 0,
  showBitcoinSymbol: true,
  backupDirectoryUri: null,
  usernameClaimDismissedAt: 0,

  initialize: async (force = false) => {
    if (get().initialized && !force) return;

    try {
      // Fast path: if no wallet exists, bail immediately with defaults
      const exists = await initService.walletExists();
      if (!exists) {
        // Onboarding can create a wallet later in this same process. Defaults are
        // not hydrated wallet settings and must not prevent that later load.
        set({ initialized: false });
        return;
      }
      const repo = initService.getRepo();

      // Load all settings in parallel for speed
      const savedPreferences = await repo.settingsRepository.getSetting('notificationPreferences');
      try {
        const parsed = savedPreferences ? JSON.parse(savedPreferences) : {};
        set({
          notificationPreferences: Object.fromEntries(
            Object.entries(notificationDefaults).map(([key, fallback]) => [
              key,
              typeof parsed[key] === 'boolean' ? parsed[key] : fallback,
            ]),
          ) as NotificationPreferences,
        });
      } catch {
        set({ notificationPreferences: { ...notificationDefaults } });
      }
      const [
        storedTheme,
        storedCurrency,
        storedMintUrl,
        storedNotifications,
        storedBiometric,
        storedNpub,
        storedNsec,
        storedNip05,
        storedHideBalance,
        storedPrimary,
        storedSeedBackedUp,
        storedBackupDismissedAt,
        storedShowBitcoinSymbol,
        storedBackupDirectoryUri,
        storedUsernameClaimDismissedAt,
        storedHideMintConnectionDisclaimer,
      ] = await Promise.all([
        repo.settingsRepository.getSetting('theme'),
        repo.settingsRepository.getSetting('secondaryCurrency'),
        repo.settingsRepository.getSetting('defaultMintUrl'),
        repo.settingsRepository.getSetting('notificationsEnabled'),
        repo.settingsRepository.getSetting('biometricEnabled'),
        repo.settingsRepository.getSetting('npub'),
        repo.settingsRepository.getSetting('nsec'),
        repo.settingsRepository.getSetting('nip05'),
        repo.settingsRepository.getSetting('hideBalance'),
        repo.settingsRepository.getSetting('primaryCurrency'),
        repo.settingsRepository.getSetting('seedBackedUp'),
        repo.settingsRepository.getSetting('backupDismissedAt'),
        repo.settingsRepository.getSetting('showBitcoinSymbol'),
        repo.settingsRepository.getSetting('backupDirectoryUri'),
        repo.settingsRepository.getSetting('usernameClaimDismissedAt'),
        repo.settingsRepository.getSetting('hideMintConnectionDisclaimer'),
      ]);

      if (storedTheme) set({ theme: storedTheme as ThemePreference });
      set({ hideMintConnectionDisclaimer: storedHideMintConnectionDisclaimer === 'true' });
      if (storedCurrency) set({ secondaryCurrency: storedCurrency });
      if (storedPrimary) set({ primaryCurrency: storedPrimary as 'SATS' | 'FIAT' });
      if (storedMintUrl) set({ defaultMintUrl: storedMintUrl });
      if (storedNotifications !== undefined && storedNotifications !== null) {
        set({ notificationsEnabled: storedNotifications === 'true' });
      }
      if (storedSeedBackedUp !== undefined && storedSeedBackedUp !== null) {
        set({ seedBackedUp: storedSeedBackedUp === 'true' });
      }
      if (storedBackupDismissedAt !== undefined && storedBackupDismissedAt !== null) {
        set({ backupDismissedAt: parseInt(storedBackupDismissedAt, 10) || 0 });
      }
      if (storedShowBitcoinSymbol !== undefined && storedShowBitcoinSymbol !== null) {
        set({ showBitcoinSymbol: storedShowBitcoinSymbol === 'true' });
      }

      if (storedBackupDirectoryUri) {
        set({ backupDirectoryUri: storedBackupDirectoryUri });
      }

      if (storedUsernameClaimDismissedAt !== undefined && storedUsernameClaimDismissedAt !== null) {
        set({ usernameClaimDismissedAt: parseInt(storedUsernameClaimDismissedAt, 10) || 0 });
      }

      // For existing users, if biometric setting isn't explicitly false, default to true to maintain security
      if (storedBiometric !== undefined && storedBiometric !== null) {
        set({ biometricEnabled: storedBiometric === 'true' });
      } else {
        set({ biometricEnabled: true });
      }

      if (storedHideBalance !== undefined && storedHideBalance !== null) {
        set({ hideBalance: storedHideBalance === 'true' });
      }

      set({ nip05: storedNip05 || null });
      if (storedNpub && storedNsec) {
        set({ npub: storedNpub, nsec: storedNsec, nip05: storedNip05 || null });
      } else {
        // Restore the cache using the existing deterministic identity.
        set({ npub: storedNpub || null, nsec: storedNsec || null });
        try {
          const mnemonic = await seedService.getMnemonic();
          if (mnemonic) {
            const keys = await seedService.getNostrKeys(mnemonic);
            await repo.settingsRepository.setSetting('npub', keys.npub);
            await repo.settingsRepository.setSetting('nsec', keys.nsec);
            set({ npub: keys.npub, nsec: keys.nsec });
          } else {
            throw new Error('Wallet identity unavailable');
          }
        } catch {
          // Privacy settings are loaded. Leave identity recovery retryable
          // without keeping the entire app behind its native splash.
          console.warn('[SettingsStore] Identity cache unavailable; retry from Settings.');
        }
      }

      set({ initialized: true });
      return;
    } catch {
      // initService retries after local repositories are ready. Never mark
      // defaults as hydrated, or a slow startup permanently loses the keys.
      console.warn('[SettingsStore] Settings unavailable; initialization can be retried.');
    }
  },

  setTheme: async (theme: ThemePreference) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('theme', theme);
      }
      set({ theme });
    } catch (error) {
      console.error('[SettingsStore] Failed to set theme:', error);
      // Still set state so UI reflects choice even if save fails
      set({ theme });
    }
  },

  setSecondaryCurrency: async (currency: string) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('secondaryCurrency', currency);
      }
      set({ secondaryCurrency: currency });
    } catch (error) {
      console.error('[SettingsStore] Failed to set secondary currency:', error);
      set({ secondaryCurrency: currency });
    }
  },

  setPrimaryCurrency: async (val: 'SATS' | 'FIAT') => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('primaryCurrency', val);
      }
      set({ primaryCurrency: val });
    } catch (error) {
      console.error('[SettingsStore] Failed to set primary currency:', error);
      set({ primaryCurrency: val });
    }
  },

  setDefaultMintUrl: async (url: string) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('defaultMintUrl', url);
      }
      set({ defaultMintUrl: url });
    } catch (error) {
      console.error('[SettingsStore] Failed to set default mint:', error);
      set({ defaultMintUrl: url });
    }
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('notificationsEnabled', enabled.toString());
      }
      set({ notificationsEnabled: enabled });
    } catch (error) {
      console.warn('[SettingsStore] Could not save notification preference');
      throw new Error('Could not save notification preference. Try again.');
    }
  },

  setNotificationPreference: async (key, enabled) => {
    const preferences = { ...get().notificationPreferences, [key]: enabled };
    await initService
      .getRepo()
      .settingsRepository.setSetting('notificationPreferences', JSON.stringify(preferences));
    set({ notificationPreferences: preferences });
  },

  setBiometricEnabled: async (enabled: boolean) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('biometricEnabled', enabled.toString());
      }
      set({ biometricEnabled: enabled });
    } catch (error) {
      console.error('[SettingsStore] Failed to set biometric enabled:', error);
      set({ biometricEnabled: enabled });
    }
  },

  setNip05: async (identifier: string | null) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('nip05', identifier ?? '');
      }
      set({ nip05: identifier });
    } catch (error) {
      console.error('[SettingsStore] Failed to set nip05:', error);
      set({ nip05: identifier });
    }
  },

  setHideBalance: async (hide: boolean) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('hideBalance', hide.toString());
      }
      set({ hideBalance: hide });
    } catch (error) {
      console.error('[SettingsStore] Failed to set hideBalance:', error);
      set({ hideBalance: hide });
    }
  },

  setSeedBackedUp: async (val: boolean) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('seedBackedUp', val.toString());
        const { useBackupStatusStore } = await import('./backupStatusStore');
        useBackupStatusStore.getState().recordPhrase(val);
      }
      set({ seedBackedUp: val });
    } catch (error) {
      console.error('[SettingsStore] Failed to set seedBackedUp:', error);
      set({ seedBackedUp: val });
    }
  },

  setBackupDismissedAt: async (val: number) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('backupDismissedAt', val.toString());
      }
      set({ backupDismissedAt: val });
    } catch (error) {
      console.error('[SettingsStore] Failed to set backupDismissedAt:', error);
      set({ backupDismissedAt: val });
    }
  },

  setShowBitcoinSymbol: async (val: boolean) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('showBitcoinSymbol', val.toString());
      }
      set({ showBitcoinSymbol: val });
    } catch (error) {
      console.error('[SettingsStore] Failed to set showBitcoinSymbol:', error);
      set({ showBitcoinSymbol: val });
    }
  },

  setBackupDirectoryUri: async (uri: string | null) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('backupDirectoryUri', uri ?? '');
      }
      set({ backupDirectoryUri: uri });
    } catch (error) {
      console.error('[SettingsStore] Failed to set backupDirectoryUri:', error);
      set({ backupDirectoryUri: uri });
    }
  },

  setUsernameClaimDismissedAt: async (val: number) => {
    try {
      const exists = await initService.walletExists();
      if (exists) {
        const repo = initService.getRepo();
        await repo.settingsRepository.setSetting('usernameClaimDismissedAt', val.toString());
      }
      set({ usernameClaimDismissedAt: val });
    } catch (error) {
      console.error('[SettingsStore] Failed to set usernameClaimDismissedAt:', error);
      set({ usernameClaimDismissedAt: val });
    }
  },
  setHideMintConnectionDisclaimer: async (hide: boolean) => {
    try {
      if (!(await initService.walletExists())) return;
      await initService
        .getRepo()
        .settingsRepository.setSetting('hideMintConnectionDisclaimer', String(hide));
      set({ hideMintConnectionDisclaimer: hide });
    } catch {
      // Keep showing the disclaimer if the preference could not be saved.
      console.warn('[SettingsStore] Could not save mint disclaimer preference');
    }
  },
}));
