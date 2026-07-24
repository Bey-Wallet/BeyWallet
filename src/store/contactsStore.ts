import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from './sqliteStorage';
import * as nip19 from 'nostr-tools/nip19';

export interface Contact {
    npub: string;
    username?: string | null;
    isFavorite: boolean;
}

interface ContactsState {
    favorites: Record<string, Contact>;
    contacts: Record<string, Contact>;
    addFavorite: (contact: Contact) => void;
    removeFavorite: (npub: string) => void;
    addContact: (contact: Omit<Contact, 'isFavorite'>) => void;
    isFavorite: (npub: string) => boolean;
}

function normalizeNpub(pub: string): string {
    if (!pub) return '';
    const trimmed = pub.trim();
    if (trimmed.startsWith('npub1')) {
        return trimmed;
    }
    if (trimmed.startsWith('nprofile1')) {
        try {
            const decoded = nip19.decode(trimmed);
            if (decoded.type === 'nprofile') {
                const hex = decoded.data.pubkey;
                const bytes = new Uint8Array(hex.length / 2);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
                }
                return nip19.npubEncode(bytes);
            }
        } catch {}
        return trimmed;
    }
    // Assume hex
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(trimmed) || trimmed.length % 2 !== 0) {
        console.warn('[ContactsStore] Invalid pubkey format (not npub, nprofile, or hex):', pub);
        return trimmed;
    }
    try {
        const bytes = new Uint8Array(trimmed.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
        }
        return nip19.npubEncode(bytes);
    } catch (e) {
        console.warn('[ContactsStore] Failed to encode hex pubkey to npub:', pub, e);
        return trimmed;
    }
}

function normalizeUsername(username?: string | null): string | null {
    if (!username) return null;
    return username.trim().replace('@bey.cash', '');
}

export const useContactsStore = create<ContactsState>()(
    persist(
        (set, get) => ({
            favorites: {},
            contacts: {},
            addFavorite: (contact) => set((state) => {
                const npub = normalizeNpub(contact.npub);
                const username = normalizeUsername(contact.username);
                return {
                    favorites: {
                        ...state.favorites,
                        [npub]: { npub, username, isFavorite: true }
                    }
                };
            }),
            removeFavorite: (npub) => set((state) => {
                const normNpub = normalizeNpub(npub);
                const newFavs = { ...state.favorites };
                delete newFavs[normNpub];
                return { favorites: newFavs };
            }),
            addContact: (contact) => set((state) => {
                const npub = normalizeNpub(contact.npub);
                const username = normalizeUsername(contact.username);
                // don't overwrite if it's already a favorite
                if (state.favorites[npub]) return state;
                return {
                    contacts: {
                        ...state.contacts,
                        [npub]: { npub, username, isFavorite: false }
                    }
                };
            }),
            isFavorite: (npub) => {
                return !!get().favorites[normalizeNpub(npub)];
            }
        }),
        {
            name: 'bey-contacts-storage',
            storage: createJSONStorage(() => sqliteStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Migrate/normalize all existing contacts/favorites
                    let changed = false;
                    const newContacts: Record<string, Contact> = {};
                    const newFavorites: Record<string, Contact> = {};

                    for (const [key, contact] of Object.entries(state.contacts || {})) {
                        const normNpub = normalizeNpub(contact.npub || key);
                        const normUser = normalizeUsername(contact.username);
                        newContacts[normNpub] = {
                            npub: normNpub,
                            username: normUser,
                            isFavorite: false
                        };
                        if (normNpub !== key || contact.username !== normUser) {
                            changed = true;
                        }
                    }

                    for (const [key, contact] of Object.entries(state.favorites || {})) {
                        const normNpub = normalizeNpub(contact.npub || key);
                        const normUser = normalizeUsername(contact.username);
                        newFavorites[normNpub] = {
                            npub: normNpub,
                            username: normUser,
                            isFavorite: true
                        };
                        if (normNpub !== key || contact.username !== normUser) {
                            changed = true;
                        }
                    }

                    if (changed) {
                        state.contacts = newContacts;
                        state.favorites = newFavorites;
                    }
                }
            }
        }
    )
);
