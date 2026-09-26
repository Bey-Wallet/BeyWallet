import React, { useCallback, useMemo, useState } from 'react';
import { Keyboard, ScrollView as NativeScrollView } from 'react-native';
import { ClipboardPaste, Search, Users, X } from '@tamagui/lucide-icons';
import { Button, Input, Spinner, Text, View, XStack, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useContactsStore, type Contact } from '~/state/contactsStore';
import { decodeNostrPublicKey, type NostrProfile } from '~/services/api/nostrProfileService';
import { useNostrProfileSearch } from '~/features/contacts/hooks/useNostrProfileSearch';
import {
  getNostrProfileLabel,
  NostrProfileItem,
} from '~/features/contacts/components/NostrProfileItem';

function contactToProfile(contact: Contact): NostrProfile | null {
  const pubkeyHex = decodeNostrPublicKey(contact.npub);
  if (!pubkeyHex) return null;

  const legacyNip05 =
    contact.nip05 ||
    (contact.username
      ? contact.username.includes('@')
        ? contact.username
        : `${contact.username}@bey.cash`
      : undefined);

  return {
    pubkeyHex,
    npub: contact.npub,
    name: contact.username || undefined,
    displayName: contact.displayName || undefined,
    nip05: legacyNip05 || undefined,
    nip05Verified: legacyNip05?.endsWith('@bey.cash'),
    source: 'identifier',
  };
}

function matchesLocalProfile(profile: NostrProfile, query: string): boolean {
  const haystack = [profile.displayName, profile.name, profile.nip05, profile.npub]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function mergeProfiles(local: NostrProfile[], remote: NostrProfile[]): NostrProfile[] {
  const merged = new Map<string, NostrProfile>();
  for (const profile of [...local, ...remote]) {
    const current = merged.get(profile.pubkeyHex);
    merged.set(profile.pubkeyHex, current ? { ...profile, ...current } : profile);
  }
  return Array.from(merged.values());
}

export default function ContactsScreen() {
  const router = useRouter();
  const favorites = useContactsStore((state) => state.favorites);
  const contacts = useContactsStore((state) => state.contacts || {});
  const [search, setSearch] = useState('');
  const { results: remoteResults, isSearching, error } = useNostrProfileSearch(search);

  const favoriteProfiles = useMemo(
    () =>
      Object.values(favorites)
        .map(contactToProfile)
        .filter((profile): profile is NostrProfile => profile !== null),
    [favorites],
  );

  const savedProfiles = useMemo(() => {
    const favoriteKeys = new Set(favoriteProfiles.map((profile) => profile.pubkeyHex));
    return Object.values(contacts)
      .map(contactToProfile)
      .filter(
        (profile): profile is NostrProfile =>
          profile !== null && !favoriteKeys.has(profile.pubkeyHex),
      );
  }, [contacts, favoriteProfiles]);

  const localProfiles = useMemo(
    () => [...favoriteProfiles, ...savedProfiles],
    [favoriteProfiles, savedProfiles],
  );

  const searchResults = useMemo(() => {
    const query = search.trim();
    if (!query) return [];
    return mergeProfiles(
      localProfiles.filter((profile) => matchesLocalProfile(profile, query)),
      remoteResults,
    );
  }, [localProfiles, remoteResults, search]);

  const openProfile = useCallback(
    (profile: NostrProfile) => {
      router.push({
        pathname: '/(modals)/contact-details',
        params: {
          npub: profile.npub,
          username: profile.name || '',
          displayName: profile.displayName || '',
          nip05: profile.nip05 || '',
        },
      });
    },
    [router],
  );

  const sendToProfile = useCallback(
    (profile: NostrProfile) => {
      router.push({
        pathname: '/(modals)/send',
        params: {
          to: profile.npub,
          username: profile.nip05 || getNostrProfileLabel(profile),
          mode: 'nostr',
        },
      });
    },
    [router],
  );

  const handlePaste = useCallback(async () => {
    const value = (await Clipboard.getStringAsync()).trim();
    if (!value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearch(value);
  }, []);

  const renderProfiles = (profiles: NostrProfile[]) =>
    profiles.map((profile, index) => (
      <NostrProfileItem
        key={profile.pubkeyHex}
        profile={profile}
        onPress={openProfile}
        onSend={sendToProfile}
        showTopSeparator={index === 0}
      />
    ));

  const hasSavedPeople = favoriteProfiles.length > 0 || savedProfiles.length > 0;
  const isSearchActive = search.trim().length > 0;

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
            <Text fontSize="$7" fontWeight="900" color="$color">
              Pay anyone on Nostr
            </Text>
            <Text fontSize="$3" color="$gray10" lineHeight={20}>
              Find a Nostr profile, then send eCash directly to their wallet.
            </Text>
          </YStack>

          <XStack height={56} bg="$gray4" rounded="$6" px="$3" items="center" gap="$2">
            <Search size={20} color="$gray10" />
            <Input
              flex={1}
              height={48}
              borderWidth={0}
              bg="transparent"
              px={0}
              placeholder="Name, name@domain, npub, or nprofile"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearchActive ? (
              <Button
                circular
                size="$2.5"
                chromeless
                icon={<X size={18} color="$gray10" />}
                accessibilityLabel="Clear search"
                onPress={() => setSearch('')}
              />
            ) : (
              <Button
                circular
                size="$2.5"
                chromeless
                icon={<ClipboardPaste size={18} color="$gray10" />}
                accessibilityLabel="Paste Nostr identifier"
                onPress={handlePaste}
              />
            )}
          </XStack>

          {isSearchActive ? (
            <YStack>
              <XStack justify="space-between" items="center" mb="$2">
                <Text fontSize="$4" fontWeight="800" color="$color">
                  Results
                </Text>
                {isSearching && <Spinner size="small" color="$accentColor" />}
              </XStack>

              {searchResults.length > 0 && renderProfiles(searchResults)}

              {!isSearching && searchResults.length === 0 && !error && (
                <YStack items="center" gap="$2" py="$8">
                  <View
                    width={64}
                    height={64}
                    rounded={32}
                    bg="$gray3"
                    items="center"
                    justify="center"
                  >
                    <Search size={28} color="$gray8" />
                  </View>
                  <Text fontSize="$5" fontWeight="800">
                    No people found
                  </Text>
                  <Text color="$gray9" text="center" lineHeight={20}>
                    Check the name or paste an exact Nostr public key.
                  </Text>
                </YStack>
              )}

              {error && (
                <YStack bg="$red2" rounded="$4" p="$3">
                  <Text color="$red10" text="center">
                    {error}
                  </Text>
                </YStack>
              )}
            </YStack>
          ) : (
            <YStack gap="$5">
              {favoriteProfiles.length > 0 && (
                <YStack>
                  <Text fontSize="$4" fontWeight="800" color="$color" mb="$2">
                    Favorites
                  </Text>
                  {renderProfiles(favoriteProfiles)}
                </YStack>
              )}

              {savedProfiles.length > 0 && (
                <YStack>
                  <Text fontSize="$4" fontWeight="800" color="$color" mb="$2">
                    Saved people
                  </Text>
                  {renderProfiles(savedProfiles)}
                </YStack>
              )}

              {!hasSavedPeople && (
                <YStack items="center" gap="$3" pt="$4" pb="$8">
                  <View
                    width={80}
                    height={80}
                    rounded={40}
                    bg="$gray3"
                    items="center"
                    justify="center"
                  >
                    <Users size={36} color="$gray8" />
                  </View>
                  <YStack items="center" gap="$1">
                    <Text fontWeight="800" fontSize="$6" color="$color">
                      Find someone to pay
                    </Text>
                    <Text fontSize="$3" color="$gray9" text="center" px="$5" lineHeight={20}>
                      Search the Nostr network or paste an npub. People you pay can be saved here.
                    </Text>
                  </YStack>
                </YStack>
              )}
            </YStack>
          )}
        </YStack>
      </NativeScrollView>
    </YStack>
  );
}
