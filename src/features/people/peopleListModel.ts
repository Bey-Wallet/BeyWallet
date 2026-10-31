import type { Person } from '~/state/peopleStore';
import type { NostrInboxItem } from '~/state/nostrInboxStore';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import type { NostrReceiveRequest, RequestPayment } from '~/state/nostrRequestStore';
import { decodeNostrPublicKey, type NostrProfile } from '~/services/api/nostrProfileService';
import { normalizeNpub } from '~/shared/utils/nostr';
import { buildConversationActivity, type ConversationActivity } from './conversationActivity';
import { hasVerifiedNip05 } from './nip05';
import { parsePersonHistoryMetadata, type PersonHistoryEntry } from './personHistory';

export interface PeopleListItem {
  id: string;
  kind: 'conversation' | 'invitation' | 'search' | 'issue';
  npub: string;
  name: string;
  picture?: string | null;
  verified: boolean;
  preview: string;
  updatedAt?: number;
  unread: boolean;
  unreadCount: number;
  icon?: 'ecash' | 'lightning' | 'request';
  issueId?: string;
  profile: NostrProfile;
}

export type PeopleListEntry = PeopleListItem | { id: string; kind: 'heading'; title: string };

export function peopleListEntries(
  groups: { title?: string; items: PeopleListItem[] }[],
  limit: number,
): PeopleListEntry[] {
  const rows: PeopleListEntry[] = [];
  let remaining = limit;
  for (const group of groups) {
    const items = group.items.slice(0, remaining);
    if (!items.length) continue;
    if (group.title)
      rows.push({ id: `heading-${group.title}`, kind: 'heading', title: group.title });
    rows.push(...items);
    remaining -= items.length;
  }
  return rows;
}

const shortKey = (npub: string) => `${npub.slice(0, 10)}…${npub.slice(-6)}`;
const compare = (a: PeopleListItem, b: PeopleListItem) =>
  (b.updatedAt || 0) - (a.updatedAt || 0) ||
  a.name.localeCompare(b.name) ||
  a.npub.localeCompare(b.npub);

function safeText(text: string): string {
  // Quoted or embedded payment payloads must not leak through a text preview either.
  if (/(?:cashu[ab]|creq[ab]|lnbc|lntb|lnurl1|lno1)/i.test(text)) return 'Payment message';
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function summarize(
  activity: ConversationActivity | undefined,
  formatAmount: (amount: number) => string,
) {
  if (!activity) return { preview: 'Start a conversation' };
  if (activity.kind === 'text') {
    const prefix = activity.direction === 'outgoing' ? 'You: ' : '';
    const state = ['Sending', 'Failed'].includes(activity.status) ? `${activity.status} · ` : '';
    return { preview: `${state}${prefix}${safeText(activity.text)}` };
  }
  const amount =
    typeof activity.amount === 'number' && Number.isFinite(activity.amount)
      ? formatAmount(activity.amount)
      : undefined;
  const icon: PeopleListItem['icon'] = activity.type?.startsWith('Lightning')
    ? 'lightning'
    : activity.type === 'Ecash request'
      ? 'request'
      : 'ecash';
  return { icon, preview: [safeText(activity.status), amount].filter(Boolean).join(' · ') };
}

export function buildPeopleListModel({
  people,
  messages,
  inbox,
  history,
  unread,
  query = '',
  remote = [],
  formatAmount,
  requests = [],
  requestPayments = [],
}: {
  people: Record<string, Person>;
  messages: ChatMessage[];
  inbox: NostrInboxItem[];
  history: PersonHistoryEntry[];
  unread: Record<string, number>;
  query?: string;
  remote?: NostrProfile[];
  formatAmount: (amount: number) => string;
  requests?: NostrReceiveRequest[];
  requestPayments?: RequestPayment[];
}) {
  const profiles = new Map<string, NostrProfile>();
  const messageGroups = new Map<string, ChatMessage[]>();
  const inboxGroups = new Map<string, NostrInboxItem[]>();
  const historyGroups = new Map<string, PersonHistoryEntry[]>();
  const addIdentity = (key: string, person?: Person, senderName?: string) => {
    const npub = normalizeNpub(key);
    const pubkeyHex = decodeNostrPublicKey(npub);
    if (!pubkeyHex || profiles.has(npub)) return;
    profiles.set(npub, {
      npub,
      pubkeyHex,
      name: person?.username || senderName || undefined,
      displayName: person?.displayName || undefined,
      picture: person?.picture || undefined,
      nip05: person?.nip05 || undefined,
      nip05Verified: person?.nip05Verified,
      source: 'identifier',
    });
  };
  for (const person of Object.values(people)) addIdentity(person.npub, person);
  for (const message of messages) {
    const npub = normalizeNpub(message.conversation);
    addIdentity(npub);
    const group = messageGroups.get(npub) || [];
    group.push({ ...message, conversation: npub });
    messageGroups.set(npub, group);
  }
  for (const item of inbox) {
    const npub = normalizeNpub(item.senderPubkey);
    addIdentity(npub, undefined, item.senderUsername);
    const group = inboxGroups.get(npub) || [];
    group.push(item);
    inboxGroups.set(npub, group);
  }
  for (const entry of history) {
    const key = parsePersonHistoryMetadata(entry.metadata)?.nostrPubkey;
    if (typeof key !== 'string') continue;
    const npub = normalizeNpub(key);
    addIdentity(npub);
    const group = historyGroups.get(npub) || [];
    group.push(entry);
    historyGroups.set(npub, group);
  }
  const conversations: PeopleListItem[] = [];
  const invitations: PeopleListItem[] = [];
  const issues: PeopleListItem[] = [];
  const localSearch: PeopleListItem[] = [];
  const remoteSearch: PeopleListItem[] = [];
  const cleaned = query.trim().toLowerCase();
  const matches = (profile: NostrProfile) =>
    [profile.displayName, profile.name, profile.nip05, profile.npub, profile.pubkeyHex].some(
      (value) => value?.toLowerCase().includes(cleaned),
    ) || normalizeNpub(query.trim()) === profile.npub;
  const identityRow = (profile: NostrProfile): PeopleListItem => ({
    id: `person-${profile.npub}`,
    kind: 'search',
    npub: profile.npub,
    name: profile.displayName || profile.name || profile.nip05 || shortKey(profile.npub),
    picture: profile.picture,
    verified: hasVerifiedNip05(profile),
    preview: profile.nip05 || shortKey(profile.npub),
    unread: false,
    unreadCount: 0,
    profile,
  });
  for (const profile of profiles.values()) {
    const npub = profile.npub;
    const person = people[npub];
    const accepted = person?.contactStatus === 'accepted';
    const blocked = person?.contactStatus === 'blocked';
    const payments = inboxGroups.get(npub) || [];
    const chat = messageGroups.get(npub) || [];
    const activity = buildConversationActivity(
      npub,
      chat,
      payments,
      historyGroups.get(npub) || [],
      accepted,
      { requests, payments: requestPayments },
    );
    const latest = activity[activity.length - 1];
    const identity = identityRow(profile);
    if (cleaned && matches(profile))
      localSearch.push({
        ...identity,
        preview: blocked ? `Blocked · ${identity.preview}` : identity.preview,
      });
    if (blocked) continue;
    const unreadCount =
      (unread[npub] || 0) +
      payments.filter((item) => !item.seen && item.status !== 'dismissed').length;
    const row: PeopleListItem = {
      ...identity,
      kind: accepted ? 'conversation' : 'invitation',
      ...summarize(latest, formatAmount),
      updatedAt: latest?.time,
      unread: unreadCount > 0,
      unreadCount,
    };
    if (accepted) conversations.push(row);
    else if (
      payments.some((item) => !['claimed', 'dismissed'].includes(item.status)) ||
      chat.some((message) => message.direction === 'incoming')
    )
      invitations.push(row);
    if (accepted)
      for (const item of payments) {
        if (
          item.status !== 'approval_required' &&
          !(item.status === 'failed' && item.failure?.retryable === false)
        )
          continue;
        issues.push({
          ...identity,
          id: `issue-${item.id}`,
          kind: 'issue',
          issueId: item.id,
          preview: [
            item.failure?.code === 'receipt_unverified'
              ? 'Receipt unverified'
              : item.status === 'approval_required'
                ? 'Mint approval needed'
                : 'Payment needs review',
            typeof item.amount === 'number' && Number.isFinite(item.amount)
              ? formatAmount(item.amount)
              : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
          icon: item.type === 'request' ? 'request' : 'ecash',
          updatedAt: item.receivedAt,
          unread: !item.seen,
          unreadCount: item.seen ? 0 : 1,
        });
      }
  }
  const seen = new Set(profiles.keys());
  const localMatches = new Set(localSearch.map((row) => row.npub));
  if (cleaned)
    for (const profile of remote) {
      const npub = normalizeNpub(profile.npub || profile.pubkeyHex);
      if (!decodeNostrPublicKey(npub)) continue;
      const saved = profiles.get(npub);
      if (saved && !localMatches.has(npub)) {
        const row = identityRow(saved);
        if (people[npub]?.contactStatus === 'blocked') row.preview = `Blocked · ${row.preview}`;
        localSearch.push(row);
        localMatches.add(npub);
      }
      if (seen.has(npub)) continue;
      seen.add(npub);
      remoteSearch.push(identityRow({ ...profile, npub }));
    }
  conversations.sort(compare);
  invitations.sort(compare);
  issues.sort(compare);
  localSearch.sort((a, b) => a.name.localeCompare(b.name));
  return {
    conversations,
    invitations,
    issues,
    localSearch,
    remoteSearch,
    requestCount: invitations.length + issues.length,
  };
}

export function peopleRowTime(time: number | undefined, now = new Date()): string {
  if (!time) return '';
  const date = new Date(time);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= day)
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(day);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= yesterday) return 'Yesterday';
  const week = new Date(day);
  week.setDate(week.getDate() - 6);
  if (date >= week) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}
