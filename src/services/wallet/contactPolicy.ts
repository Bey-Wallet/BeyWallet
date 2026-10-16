import { usePeopleStore } from '~/state/peopleStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { normalizeNpub } from '~/shared/utils/nostr';

export function contactPolicyReady(): boolean {
  return usePeopleStore.persist.hasHydrated() && useNostrReceiveSettingsStore.persist.hasHydrated();
}

export function canReceiveFrom(pubkey: string): boolean {
  if (!contactPolicyReady()) return false;
  return usePeopleStore.getState().people[normalizeNpub(pubkey)]?.contactStatus === 'accepted';
}

/** Everyone mode accepts identities, without granting mint trust. */
export function applyIncomingContactPolicy(pubkey: string): void {
  if (!contactPolicyReady()) return;
  const npub = normalizeNpub(pubkey);
  const state = usePeopleStore.getState();
  if (state.people[npub]?.contactStatus === 'blocked') return;
  if (!state.people[npub]?.hasIncomingActivity)
    state.savePerson({ npub, hasIncomingActivity: true });
  if (
    useNostrReceiveSettingsStore.getState().policy === 'everyone' &&
    !state.people[npub]?.requiresAcceptance &&
    state.people[npub]?.contactStatus !== 'accepted'
  ) {
    state.setContactStatus(npub, 'accepted');
  }
}

export async function acceptContact(pubkey: string): Promise<void> {
  if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
  const state = usePeopleStore.getState();
  if (state.people[normalizeNpub(pubkey)]?.contactStatus === 'blocked') {
    throw new Error('Unblock this person in Nostr Settings first.');
  }
  state.setContactStatus(pubkey, 'accepted');
  const { nostrClaimService } =
    require('~/services/wallet/nostrClaimService') as typeof import('~/services/wallet/nostrClaimService');
  await nostrClaimService.processPending();
}
