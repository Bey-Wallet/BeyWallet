import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { normalizeNpub } from '~/shared/utils/nostr';

export interface Contact {
  npub: string;
  username?: string | null;
  displayName?: string | null;
  nip05?: string | null;
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

function normalizeUsername(username?: string | null): string | null {
  if (!username) return null;
  return username.trim().replace('@bey.cash', '');
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      favorites: {},
      contacts: {},
      addFavorite: (contact) =>
        set((state) => {
          const npub = normalizeNpub(contact.npub);
          const username = normalizeUsername(contact.username);
          return {
            favorites: {
              ...state.favorites,
              [npub]: {
                npub,
                username,
                displayName: normalizeOptionalText(contact.displayName),
                nip05: normalizeOptionalText(contact.nip05),
                isFavorite: true,
              },
            },
          };
        }),
      removeFavorite: (npub) =>
        set((state) => {
          const normNpub = normalizeNpub(npub);
          const newFavs = { ...state.favorites };
          delete newFavs[normNpub];
          return { favorites: newFavs };
        }),
      addContact: (contact) =>
        set((state) => {
          const npub = normalizeNpub(contact.npub);
          const username = normalizeUsername(contact.username);
          // don't overwrite if it's already a favorite
          if (state.favorites[npub]) return state;
          return {
            contacts: {
              ...state.contacts,
              [npub]: {
                npub,
                username,
                displayName: normalizeOptionalText(contact.displayName),
                nip05: normalizeOptionalText(contact.nip05),
                isFavorite: false,
              },
            },
          };
        }),
      isFavorite: (npub) => {
        return !!get().favorites[normalizeNpub(npub)];
      },
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
              displayName: normalizeOptionalText(contact.displayName),
              nip05: normalizeOptionalText(contact.nip05),
              isFavorite: false,
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
              displayName: normalizeOptionalText(contact.displayName),
              nip05: normalizeOptionalText(contact.nip05),
              isFavorite: true,
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
      },
    },
  ),
);
