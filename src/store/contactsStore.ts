import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from './sqliteStorage';

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

export const useContactsStore = create<ContactsState>()(
    persist(
        (set, get) => ({
            favorites: {},
            contacts: {},
            addFavorite: (contact) => set((state) => ({
                favorites: {
                    ...state.favorites,
                    [contact.npub]: { ...contact, isFavorite: true }
                }
            })),
            removeFavorite: (npub) => set((state) => {
                const newFavs = { ...state.favorites };
                delete newFavs[npub];
                return { favorites: newFavs };
            }),
            addContact: (contact) => set((state) => {
                // don't overwrite if it's already a favorite
                if (state.favorites[contact.npub]) return state;
                return {
                    contacts: {
                        ...state.contacts,
                        [contact.npub]: { ...contact, isFavorite: false }
                    }
                };
            }),
            isFavorite: (npub) => {
                return !!get().favorites[npub];
            }
        }),
        {
            name: 'bey-contacts-storage',
            storage: createJSONStorage(() => sqliteStorage),
        }
    )
);
