import type { NostrProfile } from '~/services/api/nostrProfileService';
import { decodeNostrPublicKey } from '~/services/api/nostrProfileService';

export function isResolvedNostrRecipient(value: string): boolean {
  return !!decodeNostrPublicKey(value);
}

export function isExactNostrRecipientQuery(value: string): boolean {
  const cleaned = value.trim().replace(/^nostr:/i, '');
  return (
    isResolvedNostrRecipient(cleaned) || /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)
  );
}

export function getNostrRecipientLabel(profile: NostrProfile): string {
  return profile.nip05 || profile.displayName || profile.name || '';
}
