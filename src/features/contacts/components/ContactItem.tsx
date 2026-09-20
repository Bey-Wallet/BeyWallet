import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Text, XStack, YStack, View as TView, Separator } from 'tamagui';
import * as Haptics from 'expo-haptics';
import Blockies from '~/shared/ui/Blockies';

export interface ContactItemProps {
  npub: string;
  username?: string | null;
  onPress: (npub: string, username?: string | null) => void;
  position?: 'first' | 'middle' | 'last' | 'only';
}

function formatBeyUsername(username?: string | null): string {
  if (!username) return 'Unknown';
  const local = username.trim().replace(/^@/, '').replace(/@bey\.cash$/i, '');
  if (!local) return 'Unknown';
  return `${local}@bey.cash`;
}

function truncateNpub(npub: string): string {
  if (!npub || npub.length < 20) return npub || '';
  return `${npub.slice(0, 10)}…${npub.slice(-8)}`;
}

export const ContactItem = React.memo<ContactItemProps>(
  ({ npub, username, onPress, position = 'middle' }) => {
    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(npub, username);
    };

    const showTopSeparator = position === 'first' || position === 'only';

    return (
      <YStack>
        {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}

        <XStack py="$3" items="center">
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            <TView
              width={50}
              height={50}
              rounded={1000}
              bg="$gray4"
              items="center"
              justify="center"
              overflow="hidden"
              mr="$3"
            >
              <Blockies seed={npub} size={10} scale={5} style={{ borderRadius: 1000 }} />
            </TView>

            <YStack flex={1} mr="$2" justify="center" gap={2}>
              <Text fontSize="$4" fontWeight="bold" color="$accent4" numberOfLines={1}>
                {formatBeyUsername(username)}
              </Text>
              <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                {truncateNpub(npub)}
              </Text>
            </YStack>
          </TouchableOpacity>
        </XStack>

        <Separator borderColor="$borderColor" opacity={0.3} />
      </YStack>
    );
  },
);
