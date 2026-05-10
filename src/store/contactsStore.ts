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
    addFavorite: (contact: Contact) => void;
    removeFavorite: (npub: string) => void;
    isFavorite: (npub: string) => boolean;
}

export const useContactsStore = create<ContactsState>()(
    persist(
        (set, get) => ({
            favorites: {},
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
