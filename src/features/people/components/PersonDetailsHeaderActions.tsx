import React from 'react';
import { Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useToastController } from '@tamagui/toast';
import { Share2, Star } from '@tamagui/lucide-icons';
import { Button, XStack } from 'tamagui';
import { usePeopleStore } from '~/state/peopleStore';

export const PersonDetailsHeaderActions = React.memo(function PersonDetailsHeaderActions() {
  const { npub, username, displayName, nip05 } = useLocalSearchParams<{
    npub: string;
    username?: string;
    displayName?: string;
    nip05?: string;
  }>();
  const toast = useToastController();
  const person = usePeopleStore((state) => (npub ? state.people[npub] : undefined));
  const toggleFavorite = usePeopleStore((state) => state.toggleFavorite);
  const favorite = !!person?.isFavorite;

  if (!npub) return null;

  const handleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(npub, {
      npub,
      username: person?.username || username || null,
      displayName: person?.displayName || displayName || null,
      nip05: person?.nip05 || nip05 || null,
      nip05Verified: person?.nip05Verified,
      picture: person?.picture,
      about: person?.about,
    });
    toast.show(favorite ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const resolvedName = person?.displayName || displayName || person?.username || username;
    const resolvedNip05 = person?.nip05 || nip05;
    const intentLink = Linking.createURL('/(modals)/person-details', {
      queryParams: {
        npub,
        ...(person?.username || username ? { username: person?.username || username } : {}),
        ...(resolvedName ? { displayName: resolvedName } : {}),
        ...(resolvedNip05 ? { nip05: resolvedNip05 } : {}),
      },
    });

    try {
      await Share.share({
        message: `View ${resolvedName || 'this person'} in Bey Wallet:\n${intentLink}`,
        url: intentLink,
      });
    } catch (error: any) {
      console.warn('[PersonDetails] Could not share profile:', error?.message || error);
    }
  };

  return (
    <XStack gap="$2" mr="$2">
      <Button
        circular

        size="$3"
        icon={
          <Star
            size={19}
            color={favorite ? '#ca8a04' : '$color'}
            fill={favorite ? '#ca8a04' : 'transparent'}
          />
        }
        onPress={handleFavorite}
        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
      />
      <Button
        circular

        size="$3"
        icon={<Share2 size={18} color="$color" />}
        onPress={handleShare}
        accessibilityLabel="Share person"
      />
    </XStack>
  );
});
