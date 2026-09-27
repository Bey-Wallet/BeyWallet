import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, ScrollView as NativeScrollView } from 'react-native';
import { Activity, ClipboardPaste, Search, Users, X } from '@tamagui/lucide-icons';
import { Button, Input, Spinner, Text, View, XStack, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  selectPendingActionCount,
  selectSortedPeople,
  type Person,
  useContactsStore,
} from '~/state/contactsStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { decodeNostrPublicKey, type NostrProfile } from '~/services/api/nostrProfileService';
import { historyService } from '~/services/wallet/historyService';
import { useNostrProfileSearch } from '~/features/contacts/hooks/useNostrProfileSearch';
import {
  getNostrProfileLabel,
  NostrProfileItem,
} from '~/features/contacts/components/NostrProfileItem';

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

export default function ContactsScreen() {
  const router = useRouter();
  const people = useContactsStore((state) => state.people);
  const toggleFavorite = useContactsStore((state) => state.toggleFavorite);
  const removePerson = useContactsStore((state) => state.removePerson);
  const inboxItems = useNostrInboxStore((state) => state.items);
  const [historyInteractions, setHistoryInteractions] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const { results: remoteResults, isSearching, error } = useNostrProfileSearch(search);

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
          const npub = metadata.nostrPubkey;
          const timestamp = Number(entry.createdAt) || Date.parse(entry.createdAt) || 0;
          interactions[npub] = Math.max(interactions[npub] || 0, timestamp);
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
      const profile = decodeNostrPublicKey(item.senderPubkey);
      if (!profile) continue;
      try {
        const { nip19 } = require('nostr-tools');
        const npub = nip19.npubEncode(profile);
        result[npub] = Math.max(result[npub] || 0, item.receivedAt);
      } catch {}
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
  const isSearchActive = !!search.trim();
  const results = useMemo(
    () =>
      isSearchActive
        ? mergeProfiles(
            localProfiles.filter((profile) => matches(profile, search.trim())),
            remoteResults,
          )
        : localProfiles,
    [isSearchActive, localProfiles, remoteResults, search],
  );
  const pendingCount = selectPendingActionCount(inboxItems);

  const openProfile = useCallback(
    (profile: NostrProfile) =>
      router.push({
        pathname: '/(modals)/contact-details',
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

  return (
    <YStack flex={1} bg="$background">
      <NativeScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
      >
        <YStack gap="$5">
          <YStack gap="$2">
            <Text fontSize="$7" fontWeight="900">
              People
            </Text>
            <Text color="$gray10">Find someone on Nostr, then send or request eCash.</Text>
          </YStack>
          <XStack height={56} bg="$gray4" rounded="$6" px="$3" items="center" gap="$2">
            <Search size={20} color="$gray10" />
            <Input
              flex={1}
              borderWidth={0}
              bg="transparent"
              placeholder="Name, NIP-05, npub, or nprofile"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              circular
              chromeless
              size="$2.5"
              icon={isSearchActive ? <X size={18} /> : <ClipboardPaste size={18} />}
              onPress={isSearchActive ? () => setSearch('') : paste}
            />
          </XStack>
          {!isSearchActive && pendingCount > 0 && (
            <Button
              bg="$yellow3"
              color="$yellow11"
              justify="flex-start"
              onPress={() => router.push('/(modals)/nostr-activity')}
            >
              {pendingCount} Nostr payment{pendingCount === 1 ? '' : 's'} need attention
            </Button>
          )}
          <YStack>
            <XStack justify="space-between" items="center" mb="$2">
              <Text fontSize="$4" fontWeight="800">
                {isSearchActive ? 'Results' : 'People'}
              </Text>
              {isSearching && <Spinner size="small" />}
            </XStack>
            {results.map((profile, index) => {
              const person = people[profile.npub];
              const timestamp = interactions[profile.npub];
              return (
                <NostrProfileItem
                  key={profile.pubkeyHex}
                  profile={profile}
                  isFavorite={person?.isFavorite}
                  context={
                    timestamp
                      ? `Last interaction ${new Date(timestamp).toLocaleDateString()}`
                      : undefined
                  }
                  onPress={openProfile}
                  onLongPress={showActions}
                  onSend={send}
                  showTopSeparator={index === 0}
                />
              );
            })}
            {!isSearching && results.length === 0 && (
              <YStack items="center" gap="$3" py="$8">
                <View
                  width={72}
                  height={72}
                  rounded={36}
                  bg="$gray3"
                  items="center"
                  justify="center"
                >
                  {isSearchActive ? (
                    <Search size={30} color="$gray8" />
                  ) : (
                    <Users size={32} color="$gray8" />
                  )}
                </View>
                <Text fontSize="$5" fontWeight="800">
                  {isSearchActive ? 'No people found' : 'Find someone to pay'}
                </Text>
                {error && <Text color="$red10">{error}</Text>}
              </YStack>
            )}
          </YStack>
          {!isSearchActive && (
            <Button
              chromeless
              icon={<Activity size={18} />}
              justify="flex-start"
              onPress={() => router.push('/(modals)/nostr-activity')}
            >
              Nostr Activity
            </Button>
          )}
        </YStack>
      </NativeScrollView>
    </YStack>
  );
}
