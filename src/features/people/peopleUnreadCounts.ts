import type { Person } from '~/state/peopleStore';
import type { NostrInboxItem } from '~/state/nostrInboxStore';
import { normalizeNpub } from '~/shared/utils/nostr';

/** Count conversations once, even when both messages and payments are unread. */
export function getPeopleUnreadCounts(
  people: Record<string, Person>,
  unread: Record<string, number>,
  inbox: NostrInboxItem[],
) {
  const conversations = new Set<string>();
  for (const [key, count] of Object.entries(unread)) {
    if (count > 0) conversations.add(normalizeNpub(key));
  }
  for (const item of inbox) {
    const npub = normalizeNpub(item.senderPubkey);
    if (
      !item.seen &&
      item.status !== 'dismissed' &&
      (item.status !== 'claimed' || people[npub]?.contactStatus === 'accepted')
    )
      conversations.add(npub);
  }
  let recents = 0;
  let requests = 0;
  for (const npub of conversations) {
    const status = people[npub]?.contactStatus;
    if (status === 'blocked') continue;
    if (status === 'accepted') recents++;
    else requests++;
  }
  return { recents, requests, total: recents + requests };
}
