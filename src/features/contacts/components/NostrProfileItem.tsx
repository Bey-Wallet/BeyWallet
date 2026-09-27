import React from 'react';
import { TouchableOpacity } from 'react-native';
import { BadgeCheck, Send, Star } from '@tamagui/lucide-icons';
import { Button, Separator, Text, View, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import Blockies from '~/shared/ui/Blockies';
import type { NostrProfile } from '~/services/api/nostrProfileService';

interface NostrProfileItemProps {
  profile: NostrProfile;
  onPress: (profile: NostrProfile) => void;
  onSend: (profile: NostrProfile) => void;
  onLongPress?: (profile: NostrProfile) => void;
  isFavorite?: boolean;
  context?: string;
  showTopSeparator?: boolean;
}

function truncateNpub(npub: string): string {
  return `${npub.slice(0, 10)}…${npub.slice(-8)}`;
}

export function getNostrProfileLabel(profile: NostrProfile): string {
  return profile.displayName || profile.name || profile.nip05 || 'Nostr user';
}

export const NostrProfileItem = React.memo<NostrProfileItemProps>(
  ({ profile, onPress, onSend, onLongPress, isFavorite, context, showTopSeparator = false }) => {
    const label = getNostrProfileLabel(profile);
    const subtitle =
      profile.nip05 && profile.nip05 !== label ? profile.nip05 : truncateNpub(profile.npub);

    return (
      <YStack>
        {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}
        <XStack py="$3" items="center" gap="$2">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress(profile);
            }}
            onLongPress={() => onLongPress?.(profile)}
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            <View
              width={50}
              height={50}
              rounded={1000}
              bg="$gray4"
              items="center"
              justify="center"
              overflow="hidden"
              mr="$3"
            >
              <Blockies seed={profile.npub} size={10} scale={5} style={{ borderRadius: 1000 }} />
            </View>
            <YStack flex={1} mr="$2" justify="center" gap={2}>
              <XStack items="center" gap="$1">
                <Text fontSize="$4" fontWeight="bold" color="$accent4" numberOfLines={1} flex={1}>
                  {label}
                </Text>
                {isFavorite && <Star size={14} color="$yellow10" fill="$yellow10" />}
              </XStack>
              <XStack items="center" gap="$1">
                {profile.nip05Verified && profile.nip05 === subtitle && (
                  <BadgeCheck size={12} color="$green10" />
                )}
                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                  {subtitle}
                </Text>
              </XStack>
              {profile.nip05 && profile.nip05 !== subtitle && (
                <Text fontSize="$1" color="$gray9" numberOfLines={1}>
                  {truncateNpub(profile.npub)}
                </Text>
              )}
              {context && (
                <Text fontSize="$1" color="$gray8" numberOfLines={1}>
                  {context}
                </Text>
              )}
            </YStack>
          </TouchableOpacity>
          <Button
            circular
            size="$3"
            bg="$gray3"
            icon={<Send size={17} color="$color" />}
            accessibilityLabel={`Send eCash to ${label}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSend(profile);
            }}
          />
        </XStack>
        <Separator borderColor="$borderColor" opacity={0.3} />
      </YStack>
    );
  },
);
