import React, { useEffect, useState } from 'react';
import { YStack, XStack, Text, Button, ScrollView, Separator, useTheme, Image } from 'tamagui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Copy,
  Send,
  ArrowDownLeft,
  Activity,
  Share as ShareIcon,
  Star,
  Trash2,
  BadgeCheck,
} from '@tamagui/lucide-icons';
import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import Blockies from '~/shared/ui/Blockies';
import { useContactsStore } from '~/state/contactsStore';
import { Flex } from '~/shared/ui/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nostrProfileService, type NostrProfile } from '~/services/api/nostrProfileService';
import { personUpdateFromProfile } from '~/features/contacts/profileCache';

export default function ContactDetailsScreen() {
  const { npub, username, displayName, nip05 } = useLocalSearchParams<{
    npub: string;
    username?: string;
    displayName?: string;
    nip05?: string;
  }>();
  if (!npub) return <Text p="$4">Invalid Contact</Text>;
  const theme = useTheme();
  const toast = useToastController();
  const router = useRouter();

  const people = useContactsStore((state) => state.people);
  const toggleFavoriteAction = useContactsStore((state) => state.toggleFavorite);
  const removePerson = useContactsStore((state) => state.removePerson);
  const updatePerson = useContactsStore((state) => state.updatePerson);
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const favorite = !!people[npub]?.isFavorite;

  useEffect(() => {
    let cancelled = false;
    void nostrProfileService.getProfile(npub).then((value) => {
      if (value) updatePerson(personUpdateFromProfile(value));
      if (!cancelled) setProfile(value);
    });
    return () => {
      cancelled = true;
    };
  }, [npub, updatePerson]);

  const handleCopyNpub = async () => {
    if (!npub) return;
    await Clipboard.setStringAsync(npub);
    toast.show('Copied npub to clipboard');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleFavorite = () => {
    if (!npub) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavoriteAction(npub, {
      npub,
      username: profile?.name || username || null,
      displayName: profile?.displayName || displayName || null,
      nip05: profile?.nip05 || nip05 || null,
      nip05Verified: profile?.nip05Verified,
      picture: profile?.picture,
      about: profile?.about,
    });
    toast.show(favorite ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleSend = () => {
    router.push({
      pathname: '/(modals)/send',
      params: {
        to: npub,
        username:
          (profile?.nip05Verified ? profile.nip05 : '') ||
          profile?.displayName ||
          displayName ||
          username ||
          '',
        mode: 'nostr',
      },
    });
  };

  const handleRequest = () => {
    router.push({
      pathname: '/(modals)/receive',
      params: { from: npub, username: username || '' },
    });
  };

  const handleShare = async () => {
    if (!npub) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Construct the intent link dynamically to work in both Expo Go and Prod
    const intentLink = Linking.createURL('/(modals)/contact-details', {
      queryParams: {
        npub: npub,
        ...(username ? { username: username } : {}),
        ...(displayName ? { displayName } : {}),
        ...(nip05 ? { nip05 } : {}),
      },
    });

    // Copy to clipboard
    await Clipboard.setStringAsync(intentLink);
    toast.show('Link copied to clipboard');

    // Open Share sheet
    try {
      await Share.share({
        message: `Check out this profile on Bey Wallet: \n${intentLink}`,
        url: intentLink,
      });
    } catch (error: any) {
      console.error('Error sharing contact:', error.message);
    }
  };
  const insets = useSafeAreaInsets();

  const currentNip05 = profile?.nip05Verified ? profile.nip05 : undefined;
  const primaryLabel =
    profile?.displayName || profile?.name || displayName || username || currentNip05;
  const secondaryLabel = primaryLabel !== currentNip05 ? currentNip05 : '';

  return (
    <Flex fill bg="$background" pb={insets.bottom || 16}>
      <ScrollView
        f={1}
        contentContainerStyle={{ p: '$4', gap: '$6', paddingBottom: 100, height: '100%' }}
      >
        {/* Header / Identity */}
        <YStack items="center" gap="$4" pt="$4">
          {profile?.picture ? (
            <Image source={{ uri: profile.picture }} width={72} height={72} rounded={36} />
          ) : (
            <Blockies seed={npub} size={12} scale={6} style={{ borderRadius: 36 }} />
          )}

          <YStack items="center" gap="$1">
            {primaryLabel ? (
              <Text fontSize="$7" fontWeight="bold" color="$color">
                {primaryLabel}
              </Text>
            ) : null}
            {secondaryLabel ? (
              <XStack gap="$1" items="center">
                <BadgeCheck size={14} color="$green10" />
                <Text fontSize="$3" color="$gray10">
                  {secondaryLabel}
                </Text>
              </XStack>
            ) : null}
            <XStack items="center" gap="$2" cursor="pointer" onPress={handleCopyNpub}>
              <Text fontSize="$4" color="$gray10" numberOfLines={1} style={{ maxWidth: 200 }}>
                {`${npub.slice(0, 12)}...${npub.slice(-10)}`}
              </Text>
              <Copy size={14} color="$gray10" />
            </XStack>
          </YStack>
        </YStack>

        {/* Action Buttons */}
        <XStack justify="space-evenly" py="$2">
          <YStack items="center" gap="$2">
            <Button
              size="$5"
              circular
              bg="$gray4"
              icon={<Send size={20} color="$color" />}
              onPress={handleSend}
            />
            <Text fontSize="$3" color="$gray10">
              Send
            </Text>
          </YStack>

          <YStack items="center" gap="$2">
            <Button
              size="$5"
              circular
              bg="$gray4"
              icon={<ArrowDownLeft size={20} color="$color" />}
              onPress={handleRequest}
            />
            <Text fontSize="$3" color="$gray10">
              Request
            </Text>
          </YStack>

          <YStack items="center" gap="$2">
            <Button
              size="$5"
              circular
              bg={favorite ? '$red4' : '$gray4'}
              icon={
                <Star
                  size={20}
                  color={favorite ? '$red10' : '$color'}
                  fill={favorite ? theme.red10?.val : 'transparent'}
                />
              }
              onPress={toggleFavorite}
            />
            <Text fontSize="$3" color="$gray10">
              {favorite ? 'Favorited' : 'Favorite'}
            </Text>
          </YStack>

          <YStack items="center" gap="$2">
            <Button
              size="$5"
              circular
              bg="$gray4"
              icon={<ShareIcon size={20} color="$color" />}
              onPress={handleShare}
            />
            <Text fontSize="$3" color="$gray10">
              Share
            </Text>
          </YStack>
        </XStack>

        <Separator borderColor="$borderColor" opacity={0.5} />
        {profile?.about ? (
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="800">
              About
            </Text>
            <Text color="$gray10" lineHeight={21}>
              {profile.about}
            </Text>
          </YStack>
        ) : null}
        {people[npub] && (
          <Button
            chromeless
            color="$red10"
            icon={<Trash2 size={18} color="$red10" />}
            onPress={() => {
              removePerson(npub);
              toast.show('Removed from People');
            }}
          >
            Remove from People
          </Button>
        )}
      </ScrollView>

      {/* Floating Send Button */}
      <YStack position="absolute" bottom={insets.bottom + 16} left="$4" right="$4">
        <Button
          size="$5"
          bg="$color"
          color="$background"
          fontWeight="bold"
          icon={<Send size={20} color="$background" />}
          onPress={handleSend}
          rounded="$5"
        >
          Send Ecash
        </Button>
      </YStack>
    </Flex>
  );
}
