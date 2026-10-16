import { decodeNostrPublicKey, nostrProfileService } from '~/services/api/nostrProfileService';
import { personUpdateFromProfile } from './peopleProfileCache';
import { usePeopleStore } from '~/state/peopleStore';

/** Refresh metadata without ever replacing the contact's pinned public key. */
export async function syncConversationContact(npub: string): Promise<string> {
  const expected = decodeNostrPublicKey(npub);
  if (!expected) throw new Error('Invalid contact public key.');
  const saved = usePeopleStore.getState().people[npub];
  const profile = await nostrProfileService.getProfile(npub, { forceRefresh: true });
  if (!profile || profile.pubkeyHex !== expected)
    throw new Error('Profile unavailable. Try syncing again when online.');
  const address = saved?.nip05 || profile.nip05;
  const matches = address ? await nostrProfileService.search(address) : [];
  const verified = matches.some(
    (candidate) => candidate.pubkeyHex === expected && candidate.nip05Verified === true,
  );
  // A removed contact must not be re-added while a network check is in flight.
  if (saved && !usePeopleStore.getState().people[npub]) return 'Contact was removed.';
  usePeopleStore.getState().savePerson({
    ...personUpdateFromProfile(profile),
    npub,
    nip05: address,
    nip05Verified: verified,
  });
  return address
    ? verified
      ? 'Address verified. Profile and picture synced.'
      : 'Could not verify this address against the saved public key. The public key was kept.'
    : 'Profile and picture synced. No address is published.';
}
