import React, { useCallback, useMemo } from 'react';
import { YStack, Text, Button, View } from 'tamagui';
import { StyleSheet, FlatList } from 'react-native';
import { UserPlus2 } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useContactsStore, type Contact } from '~/store/contactsStore';
import { ContactItem } from './components/ContactItem';

export default function ContactsScreen() {
  const router = useRouter();
  const favorites = useContactsStore((state) => state.favorites);
  const contacts = useContactsStore((state) => state.contacts || {});

  const items = useMemo(() => {
    const list: Contact[] = [];
    const seen = new Set<string>();

    Object.values(favorites).forEach((fav) => {
      list.push(fav);
      seen.add(fav.npub);
    });

    Object.values(contacts).forEach((contact) => {
      if (!seen.has(contact.npub)) {
        list.push(contact);
      }
    });

    return list;
  }, [favorites, contacts]);

  const handleContactPress = useCallback(
    (npub: string, username?: string | null) => {
      router.push({
        pathname: '/(modals)/contact-details',
        params: { npub, username: username || '' },
      });
    },
    [router],
  );

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(modals)/contact-search');
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: { item: Contact; index: number }) => {
      const total = items.length;
      const position =
        total === 1 ? 'only' : index === 0 ? 'first' : index === total - 1 ? 'last' : 'middle';

      return (
        <ContactItem
          npub={item.npub}
          username={item.username}
          onPress={handleContactPress}
          position={position}
        />
      );
    },
    [handleContactPress, items.length],
  );

  if (items.length === 0) {
    return (
      <YStack flex={1} bg="$background" items="center" justify="flex-start" gap="$4" pt={40} pb={100}>
        <View style={styles.emptyIcon}>
          <UserPlus2 size={36} color="$gray8" />
        </View>
        <YStack items="center" gap="$1">
          <Text fontWeight="800" fontSize="$6" color="$color">
            No contacts yet
          </Text>
          <Text fontSize="$3" color="$gray9" text="center" px="$8" lineHeight={20}>
            Search people to add friends and pay them.
          </Text>
        </YStack>
        <Button size="$3" bg="$gray3" rounded="$4" onPress={handleSearch}>
          <Text fontWeight="700">Search people</Text>
        </Button>
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.npub}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      />
    </YStack>
  );
}

const styles = StyleSheet.create({
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(128,128,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
