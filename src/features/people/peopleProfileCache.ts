import type { NostrProfile } from '~/services/api/nostrProfileService';
import { nostrProfileService } from '~/services/api/nostrProfileService';
import type { Person } from '~/state/peopleStore';
import { usePeopleStore } from '~/state/peopleStore';

const PROFILE_REFRESH_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 3;
const inFlight = new Map<string, Promise<NostrProfile | null>>();

function isPlaceholder(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === 'nostr user' || normalized === 'unknown sender';
}

export function needsNostrProfileRefresh(person: Person, now = Date.now()): boolean {
  const hasUsefulIdentity =
    !isPlaceholder(person.displayName) ||
    !isPlaceholder(person.username) ||
    !!person.nip05 ||
    !!person.picture;

  if (!hasUsefulIdentity) return true;
  return !person.profileUpdatedAt || now - person.profileUpdatedAt >= PROFILE_REFRESH_MS;
}

export function personUpdateFromProfile(profile: NostrProfile, updatedAt = Date.now()) {
  return {
    npub: profile.npub,
    username: profile.name,
    displayName: profile.displayName,
    nip05: profile.nip05,
    nip05Verified: profile.nip05Verified,
    picture: profile.picture,
    about: profile.about,
    profileUpdatedAt: updatedAt,
  };
}

export async function hydrateSavedPerson(
  npub: string,
  options: { forceRefresh?: boolean } = {},
): Promise<NostrProfile | null> {
  const existingRequest = inFlight.get(npub);
  if (existingRequest) return existingRequest;

  const request = nostrProfileService
    .getProfile(npub, options)
    .then((profile) => {
      if (profile) {
        // updatePerson deliberately does not create a record if the person was removed
        // while the relay request was in flight.
        usePeopleStore.getState().updatePerson(personUpdateFromProfile(profile));
      }
      return profile;
    })
    .finally(() => inFlight.delete(npub));

  inFlight.set(npub, request);
  return request;
}

export async function hydrateSavedPeople(
  people: Person[],
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  const pending = options.forceRefresh
    ? people
    : people.filter((person) => needsNostrProfileRefresh(person));
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < pending.length) {
      const person = pending[nextIndex++];
      await hydrateSavedPerson(person.npub, options).catch(() => null);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, pending.length) }, () => worker()),
  );
}
