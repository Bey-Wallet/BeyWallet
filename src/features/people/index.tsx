import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Keyboard,
  RefreshControl,
  ScrollView as NativeScrollView,
  useWindowDimensions,
} from 'react-native';
import { AlertTriangle, ClipboardPaste, Search, Star, Users, X } from '@tamagui/lucide-icons';
import { Button, Input, Spinner, Text, View, XStack, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { nip19 } from 'nostr-tools';
import { selectSortedPeople, type Person, usePeopleStore } from '~/state/peopleStore';
import { type NostrInboxItem, useNostrInboxStore } from '~/state/nostrInboxStore';
import { decodeNostrPublicKey, type NostrProfile } from '~/services/api/nostrProfileService';
import { historyService } from '~/services/wallet/historyService';
import { useNostrProfileSearch } from '~/features/people/hooks/useNostrProfileSearch';
import {
  getNostrProfileLabel,
  NostrProfileItem,
} from '~/features/people/components/NostrProfileItem';
import { hydrateSavedPeople } from '~/features/people/peopleProfileCache';

type PeopleView = 'recents' | 'favorites' | 'attention';
const VIEWS: PeopleView[] = ['recents', 'favorites', 'attention'];

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
  const toggleFavorite = usePeopleStore((state) => state.toggleFavorite);
  const removePerson = usePeopleStore((state) => state.removePerson);
  const inboxItems = useNostrInboxStore((state) => state.items);
  const [historyInteractions, setHistoryInteractions] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<PeopleView>('recents');
  const [refreshing, setRefreshing] = useState(false);
  const { results: remoteResults, isSearching, error } = useNostrProfileSearch(search);

  useEffect(() => {
    void hydrateSavedPeople(Object.values(people));
  }, [people]);

  useEffect(() => {
    let cancelled = false;
    void historyService
      .getHistory(500, 0)
      .then((entries: any[]) => {
        if (cancelled) return;
        const interactions: Record<string, number> = {};
        for (const entry of entries) {
          const metadata = readMetadata(entry);
          if (metadata.via !== 'nostr' || !metadata.nostrPubkey) continue;
          const timestamp = Number(entry.createdAt) || Date.parse(entry.createdAt) || 0;
          interactions[metadata.nostrPubkey] = Math.max(
            interactions[metadata.nostrPubkey] || 0,
            timestamp,
          );
        }
        setHistoryInteractions(interactions);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const interactions = useMemo(() => {
    const result = { ...historyInteractions };
    for (const item of inboxItems) {
      const pubkey = decodeNostrPublicKey(item.senderPubkey);
      if (!pubkey) continue;
      const npub = nip19.npubEncode(pubkey);
      result[npub] = Math.max(result[npub] || 0, item.receivedAt);
    }
    return result;
  }, [historyInteractions, inboxItems]);

  const sortedPeople = useMemo(
    () => selectSortedPeople({ people } as any, interactions),
    [interactions, people],
  );
  const localProfiles = useMemo(
    () => sortedPeople.map(personToProfile).filter((profile): profile is NostrProfile => !!profile),
    [sortedPeople],
  );
  // People with interaction timestamps are already sorted first; saved people
  // without transaction activity remain discoverable at the end of Recents.
  const recentProfiles = localProfiles;
  const favoriteProfiles = useMemo(
    () => localProfiles.filter((profile) => people[profile.npub]?.isFavorite),
    [localProfiles, people],
  );
  const attentionItems = useMemo(
    () =>
      inboxItems.filter(
        (item) =>
          item.status === 'approval_required' ||
          (item.status === 'failed' && item.failure?.retryable === false),
      ),
    [inboxItems],
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
    (profile: NostrProfile) =>
      router.push({
        pathname: '/(modals)/person-details',
        params: {
          npub: profile.npub,
          username: profile.name || '',
          displayName: profile.displayName || '',
          nip05: profile.nip05 || '',
        },
      }),
    [router],
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
  const showActions = useCallback(
    (profile: NostrProfile) => {
      const person = people[profile.npub];
      if (!person) return;
      Alert.alert(getNostrProfileLabel(profile), undefined, [
        {
          text: person.isFavorite ? 'Unfavorite' : 'Favorite',
          onPress: () => toggleFavorite(profile.npub),
        },
        { text: 'Remove', style: 'destructive', onPress: () => removePerson(profile.npub) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [people, removePerson, toggleFavorite],
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
      {profiles.map((profile, index) => {
        const timestamp = interactions[profile.npub];
        return (
          <NostrProfileItem
            key={profile.pubkeyHex}
            profile={profile}
            isFavorite={people[profile.npub]?.isFavorite}
            context={
              timestamp ? `Last interaction ${new Date(timestamp).toLocaleDateString()}` : undefined
            }
            onPress={openProfile}
            onLongPress={showActions}
            onSend={send}
            showTopSeparator={index === 0}
          />
        );
      })}
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
            <Button
              circular
              chromeless
              size="$2.5"
              icon={
                isSearchActive ? <X size={17} /> : <ClipboardPaste strokeWidth={2.5} size={17} />
              }
              onPress={isSearchActive ? () => setSearch('') : paste}
              accessibilityLabel={isSearchActive ? 'Clear search' : 'Paste Nostr identifier'}
            />
          )}
        </XStack>

        {!isSearchActive && (
          <XStack gap="$1">
            <ViewTab
              label="Recents"
              active={activeView === 'recents'}
              count={recentProfiles.length}
              onPress={() => selectView('recents')}
            />
            <ViewTab
              label="Favorites"
              active={activeView === 'favorites'}
              count={favoriteProfiles.length}
              icon={<Star size={13} color="#ca8a04" />}
              onPress={() => selectView('favorites')}
            />
            <ViewTab
              label="Attention"
              active={activeView === 'attention'}
              count={attentionItems.length}
              alert={attentionItems.length > 0}
              onPress={() => selectView('attention')}
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
              isFavorite={people[profile.npub]?.isFavorite}
              onPress={openProfile}
              onLongPress={showActions}
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
            {renderProfiles(
              favoriteProfiles,
              'No favorites yet',
              'Long-press a person or open their profile to pin them here.',
            )}
          </View>
          <View width={width} flex={1}>
            <NativeScrollView
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical
              refreshControl={peopleRefreshControl}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            >
              {attentionItems.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  onPress={() => DeviceEventEmitter.emit('nostr:openClaim', item)}
                />
              ))}
              {!attentionItems.length && (
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
    <Button
      theme="gray"
      fontWeight={800}
      size="$3"
      rounded="$12"
      color={active ? '$color' : '$gray8'}
      chromeless={active === false}
      pressStyle={{ opacity: 0.75 }}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function AttentionRow({ item, onPress }: { item: NostrInboxItem; onPress: () => void }) {
  return (
    <Button unstyled width="100%" py="$3" onPress={onPress} pressStyle={{ opacity: 0.72 }}>
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
    </Button>
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
