import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeNpub } from '~/shared/utils/nostr';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import type { NostrInboxItem } from '~/state/nostrInboxStore';

export interface Person {
  npub: string;
  username?: string | null;
  displayName?: string | null;
  nip05?: string | null;
  nip05Verified?: boolean;
  picture?: string | null;
  about?: string | null;
  profileUpdatedAt?: number;
  isFavorite: boolean;
}

/** Temporary type alias for UI call sites while the feature is named contacts on disk. */
export type Contact = Person;

type PersonInput = Pick<Person, 'npub'> & Partial<Omit<Person, 'npub'>>;

interface ContactsState {
  people: Record<string, Person>;
  savePerson: (person: PersonInput) => void;
  updatePerson: (person: PersonInput) => void;
  toggleFavorite: (npub: string, person?: PersonInput) => void;
  removePerson: (npub: string) => void;
}

function normalizeOptionalText(value?: string | null): string | null {
  const text = value?.trim();
  return text || null;
}

function normalizeUsername(username?: string | null): string | null {
  const text = normalizeOptionalText(username);
  if (!text) return null;
  return text.toLowerCase().endsWith('@bey.cash') ? text.slice(0, -9) : text;
}

function mergePerson(existing: Person | undefined, input: PersonInput): Person {
  const npub = normalizeNpub(input.npub);
  return {
    npub,
    username: normalizeUsername(input.username) ?? existing?.username ?? null,
    displayName: normalizeOptionalText(input.displayName) ?? existing?.displayName ?? null,
    nip05: normalizeOptionalText(input.nip05) ?? existing?.nip05 ?? null,
    nip05Verified: input.nip05Verified ?? existing?.nip05Verified ?? false,
    picture: normalizeOptionalText(input.picture) ?? existing?.picture ?? null,
    about: normalizeOptionalText(input.about) ?? existing?.about ?? null,
    profileUpdatedAt: input.profileUpdatedAt ?? existing?.profileUpdatedAt,
    isFavorite: input.isFavorite ?? existing?.isFavorite ?? false,
  };
}

export function migrateLegacyPeople(persisted: any): Record<string, Person> {
  const people: Record<string, Person> = {};
  const mergeMap = (records: Record<string, any> | undefined, favorite?: boolean) => {
    for (const [key, value] of Object.entries(records || {})) {
      const npub = normalizeNpub(value.npub || key);
      if (!npub) continue;
      people[npub] = mergePerson(people[npub], {
        ...value,
        npub,
        isFavorite: favorite === true || value.isFavorite === true || people[npub]?.isFavorite,
      });
    }
  };
  mergeMap(persisted?.people);
  mergeMap(persisted?.contacts, false);
  mergeMap(persisted?.favorites, true);
  return people;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    (set) => ({
      people: {},
      savePerson: (person) =>
        set((state) => {
          const npub = normalizeNpub(person.npub);
          if (!npub) return state;
          return { people: { ...state.people, [npub]: mergePerson(state.people[npub], person) } };
        }),
      updatePerson: (person) =>
        set((state) => {
          const npub = normalizeNpub(person.npub);
          if (!npub || !state.people[npub]) return state;
          return { people: { ...state.people, [npub]: mergePerson(state.people[npub], person) } };
        }),
      toggleFavorite: (npubValue, person) =>
        set((state) => {
          const npub = normalizeNpub(npubValue);
          if (!npub) return state;
          const current = state.people[npub];
          const merged = mergePerson(current, person || { npub });
          return {
            people: {
              ...state.people,
              [npub]: { ...merged, isFavorite: !current?.isFavorite },
            },
          };
        }),
      removePerson: (npubValue) =>
        set((state) => {
          const people = { ...state.people };
          delete people[normalizeNpub(npubValue)];
          return { people };
        }),
    }),
    {
      name: 'bey-contacts-storage',
      storage: createJSONStorage(() => sqliteStorage),
      version: 2,
      migrate: (persisted) => ({ people: migrateLegacyPeople(persisted) }),
      merge: (persisted, current) => ({
        ...current,
        people: migrateLegacyPeople(persisted),
      }),
    },
  ),
);

export function selectPersonByNpub(state: ContactsState, npub: string): Person | undefined {
  return state.people[normalizeNpub(npub)];
}

export function selectSortedPeople(
  state: ContactsState,
  interactionByNpub: Record<string, number> = {},
): Person[] {
  return Object.values(state.people).sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const aTime = interactionByNpub[a.npub] || 0;
    const bTime = interactionByNpub[b.npub] || 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.displayName || a.nip05 || a.username || a.npub).localeCompare(
      b.displayName || b.nip05 || b.username || b.npub,
    );
  });
}

export function selectPendingActionCount(items: NostrInboxItem[]): number {
  return items.filter(
    (item) =>
      item.status === 'approval_required' ||
      (item.status === 'failed' && item.failure?.retryable === false),
  ).length;
}
