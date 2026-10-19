import { usePeopleStore } from '~/state/peopleStore';
import { useMessageStore } from '~/state/messageStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { getPeopleUnreadCounts } from '../peopleUnreadCounts';

export function usePeopleUnreadCounts() {
  const people = usePeopleStore((state) => state.people);
  const unread = useMessageStore((state) => state.unread);
  const inbox = useNostrInboxStore((state) => state.items);
  return getPeopleUnreadCounts(people, unread, inbox);
}
