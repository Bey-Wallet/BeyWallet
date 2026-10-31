import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeNpub } from '~/shared/utils/nostr';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import type { NostrInboxItem } from '~/state/nostrInboxStore';
import { nip19 } from 'nostr-tools';

export interface Person {
  npub: string;
  username?: string | null;
  displayName?: string | null;
  nip05?: string | null;
  nip05Verified?: boolean;
  picture?: string | null;
  about?: string | null;
  profileUpdatedAt?: number;
  contactStatus: 'unaccepted' | 'accepted' | 'blocked';
  relayHints?: string[];
  hasIncomingActivity?: boolean;
  requiresAcceptance?: boolean;
  chatTransport?: 'nip17' | 'nip04';
}

type PersonInput = Pick<Person, 'npub'> & Partial<Omit<Person, 'npub'>>;

interface PeopleState {
  people: Record<string, Person>;
  savePerson: (person: PersonInput) => void;
  updatePerson: (person: PersonInput) => void;
  setContactStatus: (npub: string, status: Person['contactStatus']) => void;
  unblockPeople: (npubs: string[]) => void;
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
  let relayHints = input.relayHints ?? existing?.relayHints;
  try {
    const decoded = nip19.decode(input.npub);
    if (decoded.type === 'nprofile') relayHints = decoded.data.relays;
  } catch {}
  return {
    npub,
    username: normalizeUsername(input.username) ?? existing?.username ?? null,
    displayName: normalizeOptionalText(input.displayName) ?? existing?.displayName ?? null,
    nip05: normalizeOptionalText(input.nip05) ?? existing?.nip05 ?? null,
    nip05Verified: input.nip05Verified ?? existing?.nip05Verified ?? false,
    picture: normalizeOptionalText(input.picture) ?? existing?.picture ?? null,
    about: normalizeOptionalText(input.about) ?? existing?.about ?? null,
    profileUpdatedAt: input.profileUpdatedAt ?? existing?.profileUpdatedAt,
    contactStatus: input.contactStatus ?? existing?.contactStatus ?? 'unaccepted',
    relayHints: relayHints?.filter((relay) => {
      try {
        const url = new URL(relay);
        return (
          url.protocol === 'wss:' && !!url.hostname && !url.username && !url.password && !url.hash
        );
      } catch {
        return false;
      }
    }),
    hasIncomingActivity: input.hasIncomingActivity ?? existing?.hasIncomingActivity,
    requiresAcceptance: input.requiresAcceptance ?? existing?.requiresAcceptance,
    chatTransport:
      input.chatTransport === 'nip04' || input.chatTransport === 'nip17'
        ? input.chatTransport
        : (existing?.chatTransport ?? 'nip17'),
  };
}

export function migrateLegacyPeople(persisted: any): Record<string, Person> {
  const people: Record<string, Person> = {};
  const mergeMap = (records: Record<string, any> | undefined) => {
    for (const [key, value] of Object.entries(records || {})) {
      const npub = normalizeNpub(value.npub || key);
      if (!npub) continue;
      people[npub] = mergePerson(people[npub], {
        ...value,
        npub: value.npub || key,
        contactStatus: value.contactStatus ?? people[npub]?.contactStatus ?? 'unaccepted',
      });
    }
  };
  mergeMap(persisted?.people);
  mergeMap(persisted?.contacts);
  mergeMap(persisted?.favorites);
  return people;
}

export const usePeopleStore = create<PeopleState>()(
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
      setContactStatus: (npubValue, contactStatus) =>
        set((state) => {
          const npub = normalizeNpub(npubValue);
          if (!npub) return state;
          const current = state.people[npub];
          const merged = mergePerson(current, { npub });
          return {
            people: {
              ...state.people,
              [npub]: {
                ...merged,
                contactStatus,
                requiresAcceptance:
                  contactStatus === 'unaccepted' &&
                  (current?.contactStatus === 'blocked' || current?.requiresAcceptance === true),
              },
            },
          };
        }),
      unblockPeople: (npubs) =>
        set((state) => {
          const targets = [...new Set(npubs.map(normalizeNpub))].filter(
            (npub) => state.people[npub]?.contactStatus === 'blocked',
          );
          if (!targets.length) return state;
          const people = { ...state.people };
          for (const npub of targets) {
            people[npub] = {
              ...people[npub],
              contactStatus: 'unaccepted',
              requiresAcceptance: true,
            };
          }
          return { people };
        }),
      removePerson: (npubValue) =>
        set((state) => {
          const people = { ...state.people };
          delete people[normalizeNpub(npubValue)];
          return { people };
        }),
    }),
    {
      // Keep the legacy key so upgrading users retain their saved people.
      name: 'bey-contacts-storage',
      storage: createJSONStorage(() => sqliteStorage),
      version: 3,
      partialize: (state) => ({ people: state.people }),
      migrate: (persisted) => ({ people: migrateLegacyPeople(persisted) }),
      merge: (persisted, current) => ({
        ...current,
        people: migrateLegacyPeople({
          people: (persisted as { people?: Record<string, Person> })?.people,
        }),
      }),
    },
  ),
);

export function selectPersonByNpub(state: PeopleState, npub: string): Person | undefined {
  return state.people[normalizeNpub(npub)];
}

export function selectSortedPeople(
  state: PeopleState,
  interactionByNpub: Record<string, number> = {},
): Person[] {
  return Object.values(state.people).sort((a, b) => {
    const aTime = interactionByNpub[a.npub] || 0;
    const bTime = interactionByNpub[b.npub] || 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.displayName || a.nip05 || a.username || a.npub).localeCompare(
      b.displayName || b.nip05 || b.username || b.npub,
    );
  });
}

export function selectPeopleByRecency(
  state: PeopleState,
  interactionByNpub: Record<string, number> = {},
): Person[] {
  return Object.values(state.people)
    .map((person, index) => ({ person, index }))
    .sort((a, b) => {
      const aTime = interactionByNpub[a.person.npub] || 0;
      const bTime = interactionByNpub[b.person.npub] || 0;
      return bTime - aTime || a.index - b.index;
    })
    .map(({ person }) => person);
}

export function selectPendingActionCount(items: NostrInboxItem[]): number {
  return items.filter(
    (item) =>
      item.status === 'approval_required' ||
      (item.status === 'failed' && item.failure?.retryable === false),
  ).length;
}
