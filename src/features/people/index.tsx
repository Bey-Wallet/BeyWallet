import { useMessageStore } from '~/state/messageStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Keyboard,
  RefreshControl,
  ScrollView as NativeScrollView,
  useWindowDimensions,
} from 'react-native';
import { AlertTriangle, ClipboardPaste, Search, Users, X } from '@tamagui/lucide-icons';
import { Input, Spinner, Text, View, XStack, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { nip19 } from 'nostr-tools';
import { useQuery } from '@tanstack/react-query';
import { selectPeopleByRecency, type Person, usePeopleStore } from '~/state/peopleStore';
import { type NostrInboxItem, useNostrInboxStore } from '~/state/nostrInboxStore';
import { decodeNostrPublicKey, type NostrProfile } from '~/services/api/nostrProfileService';
import { historyService } from '~/services/wallet/historyService';
import { useNostrProfileSearch } from '~/features/people/hooks/useNostrProfileSearch';
import {
  getNostrProfileLabel,
  NostrProfileItem,
} from '~/features/people/components/NostrProfileItem';
import { hydrateSavedPeople } from '~/features/people/peopleProfileCache';

type PeopleView = 'recents' | 'requests';
const VIEWS: PeopleView[] = ['recents', 'requests'];

function personToProfile(person: Person): NostrProfile | null {
  const pubkeyHex = decodeNostrPublicKey(person.npub);
  if (!pubkeyHex) return null;
  return {
    pubkeyHex,
    npub: person.npub,
    name: person.username || undefined,
    displayName: person.displayName || undefined,
    nip05: person.nip05 || undefined,
    nip05Verified: person.nip05Verified,
    picture: person.picture || undefined,
    about: person.about || undefined,
    source: 'identifier',
  };
}

function matches(profile: NostrProfile, query: string): boolean {
  return [profile.displayName, profile.name, profile.nip05, profile.npub]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query.toLowerCase());
}

function mergeProfiles(local: NostrProfile[], remote: NostrProfile[]): NostrProfile[] {
  const byPubkey = new Map<string, NostrProfile>();
  for (const profile of [...local, ...remote]) {
    const current = byPubkey.get(profile.pubkeyHex);
    byPubkey.set(profile.pubkeyHex, current ? { ...current, ...profile } : profile);
  }
  return [...byPubkey.values()];
}

function readMetadata(entry: any): Record<string, any> {
  if (entry?.metadata && typeof entry.metadata === 'object') return entry.metadata;
  try {
    return JSON.parse(entry?.metadata || '{}');
  } catch {
    return {};
  }
}

function shortSender(item: NostrInboxItem): string {
  if (item.senderUsername) return item.senderUsername;
  try {
    const npub = item.senderPubkey.startsWith('npub1')
      ? item.senderPubkey
      : nip19.npubEncode(item.senderPubkey);
    return `${npub.slice(0, 10)}…${npub.slice(-6)}`;
  } catch {
    return 'Unknown sender';
  }
}

export default function PeopleScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<NativeScrollView>(null);
  const people = usePeopleStore((state) => state.people);

  const messages = useMessageStore((state) => state.recent);
  const unread = useMessageStore((state) => state.unread);
  const [visibleCount, setVisibleCount] = useState(50);
  const inboxItems = useNostrInboxStore((state) => state.items);
  const { data: paymentHistory = [] } = useQuery({
    queryKey: ['history', 'people'],
    queryFn: () => historyService.getHistory(500, 0),
  });
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<PeopleView>('recents');
  const [refreshing, setRefreshing] = useState(false);
  const { results: remoteResults, isSearching, error } = useNostrProfileSearch(search);

  useEffect(() => {
    void hydrateSavedPeople(Object.values(people));
  }, [people]);

  const historyInteractions = useMemo(() => {
    const interactions: Record<string, number> = {};
    for (const entry of paymentHistory) {
      const metadata = readMetadata(entry);
      if (metadata.via !== 'nostr' || !metadata.nostrPubkey) continue;
      const timestamp = Number(entry.createdAt) || Date.parse(String(entry.createdAt)) || 0;
      const npub = normalizeNpub(metadata.nostrPubkey);
      interactions[npub] = Math.max(
        interactions[npub] || 0,
        timestamp < 1e10 ? timestamp * 1000 : timestamp,
      );
    }
    return interactions;
  }, [paymentHistory]);

  const interactions = useMemo(() => {
    const result = { ...historyInteractions };
    for (const item of inboxItems) {
      const pubkey = decodeNostrPublicKey(item.senderPubkey);
      if (!pubkey) continue;
      const npub = nip19.npubEncode(pubkey);
      result[npub] = Math.max(result[npub] || 0, item.receivedAt);
    }
    for (const message of messages)
      result[message.conversation] = Math.max(result[message.conversation] || 0, message.createdAt);
    return result;
  }, [historyInteractions, inboxItems, messages]);

  const sortedPeople = useMemo(
    () => selectPeopleByRecency({ people } as any, interactions),
    [interactions, people],
  );
  const localProfiles = useMemo(
    () => sortedPeople.map(personToProfile).filter((profile): profile is NostrProfile => !!profile),
    [sortedPeople],
  );
  const recentProfiles = localProfiles.filter(
    (profile) => people[profile.npub]?.contactStatus === 'accepted',
  );
  const requestIdentities = new Set([
    ...inboxItems
      .filter((item) => item.status !== 'dismissed' && item.status !== 'claimed')
      .map((item) => normalizeNpub(item.senderPubkey)),
    ...messages
      .filter((message) => message.direction === 'incoming')
      .map((message) => message.conversation),
  ]);
  const requestProfiles = localProfiles.filter(
    (profile) =>
      people[profile.npub]?.contactStatus === 'unaccepted' && requestIdentities.has(profile.npub),
  );
  const attentionItems = inboxItems.filter(
    (item) =>
      people[normalizeNpub(item.senderPubkey)]?.contactStatus === 'accepted' &&
      (item.status === 'approval_required' ||
        (item.status === 'failed' && item.failure?.retryable === false)),
  );
  const isSearchActive = !!search.trim();
  const searchResults = useMemo(
    () =>
      isSearchActive
        ? mergeProfiles(
            localProfiles.filter((profile) => matches(profile, search.trim())),
            remoteResults,
          )
        : [],
    [isSearchActive, localProfiles, remoteResults, search],
  );

  const openProfile = useCallback(
    (profile: NostrProfile) => {
      if (search.trim().startsWith('nprofile1') && normalizeNpub(search.trim()) === profile.npub) {
        usePeopleStore.getState().savePerson({ npub: search.trim() });
      }
      router.push({
        pathname: '/(modals)/conversation',
        params: {
          npub: profile.npub,
          username: profile.name || '',
          displayName: profile.displayName || '',
          nip05: profile.nip05 || '',
        },
      });
    },
    [router, search],
  );
  const send = useCallback(
    (profile: NostrProfile) =>
      router.push({
        pathname: '/(modals)/send',
        params: {
          to: profile.npub,
          username: profile.nip05 || getNostrProfileLabel(profile),
          mode: 'nostr',
        },
      }),
    [router],
  );
  const paste = useCallback(async () => {
    const value = (await Clipboard.getStringAsync()).trim();
    if (value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSearch(value);
    }
  }, []);
  const selectView = useCallback(
    (view: PeopleView) => {
      Haptics.selectionAsync();
      setActiveView(view);
      pagerRef.current?.scrollTo({ x: VIEWS.indexOf(view) * width, animated: true });
    },
    [width],
  );

  const refreshPeople = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await hydrateSavedPeople(Object.values(usePeopleStore.getState().people), {
        forceRefresh: true,
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const peopleRefreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refreshPeople}
      tintColor="#ca8a04"
      colors={['#ca8a04']}
    />
  );

  const renderProfiles = (profiles: NostrProfile[], emptyTitle: string, emptyBody: string) => (
    <NativeScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      refreshControl={peopleRefreshControl}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
    >
      {profiles.slice(0, visibleCount).map((profile, index) => {
        const timestamp = interactions[profile.npub];
        const message = messages.find((entry) => entry.conversation === profile.npub);
        const payment = inboxItems
          .filter((item) => normalizeNpub(item.senderPubkey) === profile.npub)
          .sort((a, b) => b.receivedAt - a.receivedAt)[0];
        const paymentIsLatest = payment && (!message || payment.receivedAt >= message.createdAt);
        const hasUnread =
          unread[profile.npub] ||
          inboxItems.some(
            (item) =>
              normalizeNpub(item.senderPubkey) === profile.npub &&
              !item.seen &&
              item.status !== 'dismissed',
          );
        return (
          <NostrProfileItem
            key={profile.pubkeyHex}
            profile={profile}
            context={[
              hasUnread ? 'Unread' : '',
              paymentIsLatest
                ? `${payment.type === 'request' ? 'Request' : 'Payment'} · ${payment.amount.toLocaleString()} sats`
                : message?.paymentId
                  ? `${message.paymentType === 'request' ? 'Request sent' : 'Payment sent'} · ${message.paymentAmount?.toLocaleString()} sats`
                  : message?.text || 'Payment conversation',
              timestamp ? new Date(timestamp).toLocaleString() : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={openProfile}
            onSend={send}
            showTopSeparator={index === 0}
          />
        );
      })}
      {profiles.length > visibleCount && (
        <AppPressable minHeight={48} onPress={() => setVisibleCount((count) => count + 50)}>
          <Text>Load more</Text>
        </AppPressable>
      )}
      {!profiles.length && <EmptyState title={emptyTitle} body={emptyBody} />}
    </NativeScrollView>
  );

  return (
    <YStack flex={1} bg="$background">
      <YStack px="$3" pt="$0" pb="$2" gap="$2.5">
        <XStack height={50} bg="$gray4" rounded="$6" px="$3" items="center" gap="$2">
          <Search size={19} strokeWidth={2.5} color="$gray10" />
          <Input
            flex={1}
            height={42}
            borderWidth={0}
            bg="transparent"
            px={0}
            fontWeight={800}
            placeholder="Search Nostr"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={Keyboard.dismiss}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isSearching ? (
            <Spinner size="small" />
          ) : (
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="xxsmall"

              shape="circular"
              accessibilityLabel={isSearchActive ? 'Clear search' : 'Paste Nostr identifier'}
              icon={
                isSearchActive ? <X size={17} /> : <ClipboardPaste strokeWidth={2.5} size={17} />
              }
              onPress={isSearchActive ? () => setSearch('') : paste}
            />
          )}
        </XStack>

        {!isSearchActive && (
          <XStack gap="$1">
            <ViewTab
              label="Recent"
              active={activeView === 'recents'}
              count={recentProfiles.length}
              onPress={() => selectView('recents')}
            />
            <ViewTab
              label="Requests"
              active={activeView === 'requests'}
              count={requestProfiles.length + attentionItems.length}
              onPress={() => selectView('requests')}
            />
          </XStack>
        )}
      </YStack>

      {isSearchActive ? (
        <NativeScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical
          refreshControl={peopleRefreshControl}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        >
          {searchResults.map((profile, index) => (
            <NostrProfileItem
              key={profile.pubkeyHex}
              profile={profile}
              onPress={openProfile}
              onSend={send}
              showTopSeparator={index === 0}
            />
          ))}
          {!isSearching && !searchResults.length && (
            <EmptyState
              title="No people found"
              body={error || 'Try a display name, NIP-05 address, npub, or nprofile.'}
            />
          )}
        </NativeScrollView>
      ) : (
        <NativeScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveView(VIEWS[index] || 'recents');
          }}
        >
          <View width={width} flex={1}>
            {renderProfiles(
              recentProfiles,
              'No recent people',
              'People appear here after you send, request, or receive over Nostr.',
            )}
          </View>
          <View width={width} flex={1}>
            <NativeScrollView
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical
              refreshControl={peopleRefreshControl}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            >
              {requestProfiles.map((profile) => (
                <NostrProfileItem
                  key={profile.npub}
                  profile={profile}
                  context={
                    messages.find((message) => message.conversation === profile.npub)?.text ||
                    `${inboxItems.filter((item) => normalizeNpub(item.senderPubkey) === profile.npub && item.status !== 'dismissed' && item.status !== 'claimed').length} waiting payment offers or requests`
                  }
                  onPress={openProfile}
                  onSend={send}
                />
              ))}
              {!!attentionItems.length && (
                <Text fontWeight="800" py="$3">
                  Payment issues
                </Text>
              )}
              {attentionItems.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  onPress={() => DeviceEventEmitter.emit('nostr:openClaim', item)}
                />
              ))}
              {!attentionItems.length && !requestProfiles.length && (
                <EmptyState
                  title="You're all caught up"
                  body="Payments that need mint approval or manual action will appear here."
                />
              )}
            </NativeScrollView>
          </View>
        </NativeScrollView>
      )}
    </YStack>
  );
}

function ViewTab({
  label,
  count,
  active,
  alert,
  icon,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  alert?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <AppPressable
      px={12}
      py={4}
      bg={active === false ? 'transparent' : '$gray4'}
      accessibilityState={{ selected: active }}
      theme="gray"
      rounded="$12"
      pressStyle={{ opacity: 0.75 }}
      onPress={onPress}
      minHeight={36}
      flexDirection="row"
      items="center"
      justify="center"
      gap={8}
    >
      <Text color={active ? '$color' : '$gray8'} fontSize="$3" fontWeight={800}>
        {label}
        {count > 0 ? ` (${count})` : ''}
      </Text>
    </AppPressable>
  );
}

function AttentionRow({ item, onPress }: { item: NostrInboxItem; onPress: () => void }) {
  return (
    <AppPressable
      width="100%"
      py="$3"
      onPress={onPress}
      pressStyle={{ opacity: 0.72 }}
      minHeight={48}
      flexDirection="row"
      items="center"
      justify="center"
      gap={8}
    >
      <XStack items="center" gap="$3">
        <View width={44} height={44} rounded={22} bg="$yellow3" items="center" justify="center">
          <AlertTriangle size={20} color="$yellow11" />
        </View>
        <YStack flex={1} gap={2}>
          <Text fontWeight="800" numberOfLines={1}>
            {shortSender(item)}
          </Text>
          <Text fontSize="$2" color="$gray10" numberOfLines={1}>
            {item.failure?.code === 'unknown_mint'
              ? 'Mint approval required'
              : item.error || 'Action required'}
          </Text>
        </YStack>
        <Text fontWeight="900">{item.amount.toLocaleString()} sats</Text>
      </XStack>
    </AppPressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <YStack items="center" gap="$2" pt="$8" px="$6">
      <View width={58} height={58} rounded={29} bg="$gray3" items="center" justify="center">
        <Users size={26} color="$gray8" />
      </View>
      <Text fontSize="$5" fontWeight="800" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text fontSize="$3" color="$gray9" lineHeight={20} style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </YStack>
  );
}
