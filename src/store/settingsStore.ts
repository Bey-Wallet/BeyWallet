import { create } from 'zustand';
import { initService } from '../services/core';
import { seedService } from '../services/seedService';
import { DEFAULT_MINT } from './constants';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
    theme: ThemePreference;
    secondaryCurrency: string;
    defaultMintUrl: string;
    initialized: boolean;
    npub: string | null;
    nsec: string | null;
    nip05: string | null;             // e.g. "zaheer@nostrcheck.me"
    initialize: (force?: boolean) => Promise<void>;
    setTheme: (theme: ThemePreference) => Promise<void>;
    setSecondaryCurrency: (currency: string) => Promise<void>;
    setDefaultMintUrl: (url: string) => Promise<void>;
    notificationsEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
    setNip05: (identifier: string | null) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    theme: 'system',
    secondaryCurrency: 'USD',
    defaultMintUrl: DEFAULT_MINT,
    notificationsEnabled: true,
    initialized: false,
    npub: null,
    nsec: null,
    nip05: null,

    initialize: async (force = false) => {
        if (get().initialized && !force) return;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        // Retry to wait for initService to initialize the repo, 
        // but only if a wallet exists.
        for (let i = 0; i < 15; i++) {
            try {
                // Check if wallet exists first. If not, we don't need to try getRepo.
                const exists = await initService.walletExists();
                if (!exists) {
                    set({ initialized: true });
                    return;
                }

                const repo = initService.getRepo();
                const storedTheme = await repo.settingsRepository.getSetting('theme');
                if (storedTheme) {
                    set({ theme: storedTheme as ThemePreference });
                }
                const storedCurrency = await repo.settingsRepository.getSetting('secondaryCurrency');
                if (storedCurrency) {
                    set({ secondaryCurrency: storedCurrency });
                }

                // Load default mint
                const storedMintUrl = await repo.settingsRepository.getSetting('defaultMintUrl');
                if (storedMintUrl) {
                    set({ defaultMintUrl: storedMintUrl });
                }

                // Load notifications setting
                const storedNotifications = await repo.settingsRepository.getSetting('notificationsEnabled');
                if (storedNotifications !== undefined && storedNotifications !== null) {
                    set({ notificationsEnabled: storedNotifications === 'true' });
                }

                // Load Nostr keys
                const storedNpub = await repo.settingsRepository.getSetting('npub');
                const storedNsec = await repo.settingsRepository.getSetting('nsec');
                const storedNip05 = await repo.settingsRepository.getSetting('nip05');

                if (storedNpub && storedNsec) {
                    set({ npub: storedNpub, nsec: storedNsec, nip05: storedNip05 || null });
                } else {
                    // Generate and cache them if they don't exist yet
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
                // If it's a "Repositories not initialized" error, we just wait.
                // Other errors we might want to know about eventually.
                if (i === 14) {
                    console.log('[SettingsStore] Repo not available yet, using defaults.');
                    set({ initialized: true });
                }
                await delay(300);
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
}));
