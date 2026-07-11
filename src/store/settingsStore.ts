import { create } from 'zustand';
import { initService } from '../services/core';
import { seedService } from '../services/seedService';
import { DEFAULT_MINT } from './constants';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
    theme: ThemePreference;
    secondaryCurrency: string;
    primaryCurrency: 'SATS' | 'FIAT';
    defaultMintUrl: string;
    initialized: boolean;
    npub: string | null;
    nsec: string | null;
    nip05: string | null;             // e.g. "zaheer@nostrcheck.me"
    hideBalance: boolean;
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
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
    biometricEnabled: boolean;
    setBiometricEnabled: (enabled: boolean) => Promise<void>;
    setNip05: (identifier: string | null) => Promise<void>;
    setHideBalance: (hide: boolean) => Promise<void>;
    showBitcoinSymbol: boolean;
    setShowBitcoinSymbol: (val: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    theme: 'system',
    secondaryCurrency: 'USD',
    primaryCurrency: 'SATS',
    defaultMintUrl: DEFAULT_MINT,
    notificationsEnabled: true,
    biometricEnabled: false,
    initialized: false,
    npub: null,
    nsec: null,
    nip05: null,
    hideBalance: false,
    seedBackedUp: false,
    backupDismissedAt: 0,
    showBitcoinSymbol: false,

    initialize: async (force = false) => {
        if (get().initialized && !force) return;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        // Fast path: if no wallet exists, bail immediately with defaults
        const exists = await initService.walletExists();
        if (!exists) {
            set({ initialized: true });
            return;
        }

        // Wait for repo with exponential backoff (max ~3s)
        for (let i = 0; i < 5; i++) {
            try {
                const repo = initService.getRepo();

                // Load all settings in parallel for speed
                const [storedTheme, storedCurrency, storedMintUrl, storedNotifications, storedBiometric, storedNpub, storedNsec, storedNip05, storedHideBalance, storedPrimary, storedSeedBackedUp, storedBackupDismissedAt, storedShowBitcoinSymbol] = await Promise.all([
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
                ]);

                if (storedTheme) set({ theme: storedTheme as ThemePreference });
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
                
                // For existing users, if biometric setting isn't explicitly false, default to true to maintain security
                if (storedBiometric !== undefined && storedBiometric !== null) {
                    set({ biometricEnabled: storedBiometric === 'true' });
                } else {
                    set({ biometricEnabled: true });
                }

                if (storedHideBalance !== undefined && storedHideBalance !== null) {
                    set({ hideBalance: storedHideBalance === 'true' });
                }

                if (storedNpub && storedNsec) {
                    set({ npub: storedNpub, nsec: storedNsec, nip05: storedNip05 || null });
                } else {
                    // Generate and cache Nostr keys if they don't exist yet
                    console.log('[SettingsStore] Nostr keys not in DB, generating and caching...');
                    const mnemonic = await seedService.getMnemonic();
                    if (mnemonic) {
                        const keys = await seedService.getNostrKeys(mnemonic);
                        await repo.settingsRepository.setSetting('npub', keys.npub);
                        await repo.settingsRepository.setSetting('nsec', keys.nsec);
                        set({ npub: keys.npub, nsec: keys.nsec });
                    }
                }

                set({ initialized: true });
                return;
            } catch (error) {
                if (i === 4) {
                    console.log('[SettingsStore] Repo not available after retries, using defaults.');
                    set({ initialized: true });
                }
                await delay(200 * (i + 1)); // 200, 400, 600, 800, 1000
            }
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
            console.error('[SettingsStore] Failed to set notifications enabled:', error);
            set({ notificationsEnabled: enabled });
        }
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
}));
